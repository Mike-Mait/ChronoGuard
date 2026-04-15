import { FastifyInstance } from "fastify";
import { config, getStripe } from "../config/env";
import { upgradeToProByEmail, downgradeToFreeByStripeCustomerId } from "./keys";
import { sendWelcomeProEmail, sendSubscriptionCancelledEmail, normalizeEmail } from "../utils/email";

export async function webhooksRoute(app: FastifyInstance) {
  // Capture raw body for Stripe signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req: any, body: string, done: (err: Error | null, body?: any) => void) => {
      done(null, body);
    }
  );

  app.post(
    "/api/webhooks/stripe",
    {
      schema: { hide: true },
    },
    async (request, reply) => {
      if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
        return (reply as any).code(500).send({
          error: "Stripe not configured",
          code: "STRIPE_NOT_CONFIGURED",
          message: "Payment processing is not available.",
        });
      }

      const stripe = getStripe();
      const sig = request.headers["stripe-signature"];

      let event: any;
      try {
        event = stripe.webhooks.constructEvent(
          request.body as string,
          sig,
          config.stripeWebhookSecret
        );
      } catch (err: any) {
        request.log.error(err, "Stripe webhook signature verification failed");
        return (reply as any).code(400).send({
          error: "Webhook signature verification failed",
          code: "WEBHOOK_ERROR",
          message: "Invalid webhook signature.",
        });
      }

      request.log.info({ type: event.type }, "Stripe webhook received");

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const rawEmail = session.metadata?.email || session.customer_email;
          const customerId = session.customer;

          // Normalize the email before DB lookup. Stripe preserves the
          // case the user typed into checkout — if we wrote the DB row as
          // "bob@example.com" but Stripe returns "Bob@example.com" on
          // the session, upgradeToProByEmail would miss the row and the
          // user would stay on Free tier despite paying. Canonicalize at
          // the edge so every internal call sees the same form.
          const email = rawEmail ? normalizeEmail(rawEmail) : null;

          if (email) {
            await upgradeToProByEmail(email, customerId);
            request.log.info({ email, customerId }, "User upgraded to Pro tier");

            // Fire-and-forget Pro welcome email. Sent AFTER the upgrade
            // has persisted so the thank-you can't land before the tier
            // bump takes effect. Never throws — a broken SMTP must not
            // cause us to return non-2xx to Stripe (which would trigger
            // retries and could double-upgrade the customer).
            sendWelcomeProEmail(email).catch((err) =>
              request.log.warn(err, "Failed to send Pro welcome email")
            );
          } else {
            request.log.warn({ sessionId: session.id }, "checkout.session.completed missing email");
          }
          break;
        }

        case "customer.subscription.deleted": {
          const customerId = event.data.object.customer;
          const result = await downgradeToFreeByStripeCustomerId(customerId);
          request.log.info(
            { customer: customerId, downgraded: result.ok },
            "Subscription cancelled — downgraded to free tier"
          );

          // Fire-and-forget thank-you email. Only sent for explicit
          // subscription cancellation — NOT for payment_failed (that's a
          // different, more urgent comms path: "update your card") and
          // NOT for charge.refunded (the refund receipt from Stripe is
          // the appropriate ack there).
          if (result.ok && result.email) {
            sendSubscriptionCancelledEmail(result.email).catch((err) =>
              request.log.warn(err, "Failed to send cancellation email")
            );
          }
          break;
        }

        case "charge.refunded": {
          const customerId = event.data.object.customer;
          const result = await downgradeToFreeByStripeCustomerId(customerId);
          request.log.info(
            { customer: customerId, downgraded: result.ok },
            "Charge refunded — downgraded to free tier"
          );
          break;
        }

        case "invoice.payment_failed": {
          // DELIBERATELY does NOT downgrade. Stripe Smart Retries will
          // retry the failed invoice on an exponential schedule for up
          // to ~3 weeks before giving up; during that window the user
          // still has a valid subscription and should keep Pro access.
          // If Stripe ultimately gives up, we'll receive
          // customer.subscription.deleted and downgrade *then*.
          //
          // Dropping a paying customer to Free tier on the first card
          // blip (e.g. a renewal-day decline while they're at dinner)
          // would be a jarring experience and is the wrong tradeoff for
          // a service where the key keeps working regardless — we just
          // reduce the monthly ceiling.
          //
          // Log at info level so failures are still visible to ops, but
          // don't mutate account state.
          const customerId = event.data.object.customer;
          request.log.info(
            { customer: customerId },
            "Payment failed — leaving tier unchanged (waiting on subscription outcome)"
          );
          break;
        }

        default:
          request.log.info({ type: event.type }, "Unhandled Stripe event");
      }

      return reply.send({ received: true });
    }
  );
}
