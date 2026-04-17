import { FastifyInstance } from "fastify";
import { config, getStripe } from "../config/env";
import {
  upgradeToProByEmail,
  downgradeToFreeByStripeCustomerId,
  getEmailByStripeCustomerId,
} from "./keys";
import { sendWelcomeProEmail, sendCancellationScheduledEmail, normalizeEmail } from "../utils/email";

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

        case "customer.subscription.updated": {
          // Fires on ANY subscription mutation (plan change, quantity,
          // trial extension, etc.), so we have to narrowly scope this
          // handler to the one transition we care about: the user just
          // clicked Cancel in the Stripe Portal and Stripe has flagged
          // the subscription to end at period-end.
          //
          // Stripe populates event.data.previous_attributes with ONLY
          // the fields that actually changed on this event. Checking for
          // cancel_at_period_end there filters out every unrelated
          // update — without it, this case would fire noisy emails on
          // renewals, card updates, etc.
          const subscription = event.data.object;
          const previousAttributes =
            (event.data as any).previous_attributes || {};

          const justScheduledCancellation =
            subscription.cancel_at_period_end === true &&
            "cancel_at_period_end" in previousAttributes &&
            previousAttributes.cancel_at_period_end === false;

          if (!justScheduledCancellation) {
            break;
          }

          const customerId = subscription.customer;
          // current_period_end is unix seconds — multiply to ms for Date.
          // This is the moment Pro access actually ends and the
          // subscription.deleted event will fire to downgrade the row.
          const periodEnd = new Date(subscription.current_period_end * 1000);

          const email = await getEmailByStripeCustomerId(customerId);
          if (!email) {
            request.log.warn(
              { customer: customerId },
              "cancel-scheduled: no account found for Stripe customer"
            );
            break;
          }

          request.log.info(
            { customer: customerId, email, periodEnd: periodEnd.toISOString() },
            "Pro subscription cancellation scheduled for period-end"
          );

          // Fire-and-forget. Mail failures must not 500 the webhook —
          // Stripe would retry and we'd risk sending duplicates if the
          // second attempt succeeded. Same discipline as the other
          // webhook email paths.
          sendCancellationScheduledEmail(email, periodEnd).catch((err) =>
            request.log.warn(err, "Failed to send cancellation-scheduled email")
          );
          break;
        }

        case "customer.subscription.deleted": {
          // Fires at period-end (or immediately if the user/admin chose
          // "cancel immediately"). We downgrade silently here — the
          // user-facing notification was already sent on the earlier
          // customer.subscription.updated event when they first clicked
          // Cancel. Sending a second email at period-end would be noise.
          const customerId = event.data.object.customer;
          const result = await downgradeToFreeByStripeCustomerId(customerId);
          request.log.info(
            { customer: customerId, downgraded: result.ok },
            "Subscription ended — downgraded to free tier"
          );
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
