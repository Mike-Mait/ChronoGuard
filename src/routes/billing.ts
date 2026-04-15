import { FastifyInstance } from "fastify";
import { config, getStripe } from "../config/env";
import { getPrisma } from "../db/client";
import { createBillingToken, verifyBillingToken } from "../utils/resetTokens";
import { sendBillingPortalEmail, normalizeEmail } from "../utils/email";
import { captureException } from "../config/sentry";

// ─── Rate limiter: mirrors the reset-request limiter intentionally ───
// The billing-portal flow has the same enumeration-oracle surface as the
// reset flow (POST email, get generic response), so we apply the same
// per-IP and per-email caps. Deliberately separate Map instances from the
// reset limiter so a user who legitimately resets *and* manages billing
// in close succession isn't blocked.
const MAX_CACHE_SIZE = 10_000;
const billingRequestCounts = new Map<string, { count: number; resetAt: number }>();
const BILLING_RATE_LIMIT = 3;
const BILLING_RATE_WINDOW_MS = 15 * 60_000;

function evictOldestIfNeeded<K, V>(map: Map<K, V>, limit: number): void {
  if (map.size > limit) {
    const oldest = map.keys().next().value!;
    map.delete(oldest);
  }
}

function checkBillingRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = billingRequestCounts.get(key);
  if (!entry || now >= entry.resetAt) {
    evictOldestIfNeeded(billingRequestCounts, MAX_CACHE_SIZE);
    billingRequestCounts.set(key, {
      count: 1,
      resetAt: now + BILLING_RATE_WINDOW_MS,
    });
    return true;
  }
  entry.count++;
  return entry.count <= BILLING_RATE_LIMIT;
}

export async function billingRoute(app: FastifyInstance) {
  // ─── Request a billing-portal link ───
  // Enumeration-safe: always returns an identical generic response whether
  // the email exists, is Free tier, or is Pro tier. Only Pro subscribers
  // actually receive an email, but the attacker can't tell from the HTTP
  // response which is which. (Same pattern as /api/keys/reset-request.)
  app.post(
    "/api/billing/portal-request",
    { schema: { hide: true } },
    async (request, reply) => {
      const { email: rawEmail } = request.body as { email?: string };
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!rawEmail || rawEmail.length > 254 || !emailRegex.test(rawEmail)) {
        return reply.code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message: "Provide a valid email address.",
        });
      }

      // Normalize before lookup / token mint — same discipline as the
      // reset-request handler. Ensures "Bob@example.com" matches the
      // canonical "bob@example.com" row in the DB.
      const email = normalizeEmail(rawEmail);

      const genericOk = {
        message:
          "If this email is associated with a Pro subscription, we've sent a secure management link. Check your inbox (and spam folder).",
      };

      // Rate limit per IP AND per email — same reasoning as reset-request.
      const ipOk = checkBillingRateLimit(`ip:${request.ip}`);
      const emailOk = checkBillingRateLimit(`email:${email.toLowerCase()}`);
      if (!ipOk || !emailOk) {
        request.log.warn(
          { ip: request.ip, email, requestId: request.id },
          "Billing portal-request rate limit hit"
        );
        return reply.send(genericOk);
      }

      // Only Pro subscribers with a Stripe customer ID can be sent a
      // portal link — the portal session needs a real customer to attach
      // to. Free users silently get the generic response (no email).
      const prisma = getPrisma();
      let isEligible = false;
      if (prisma) {
        try {
          const record = await prisma.apiKey.findUnique({ where: { email } });
          isEligible =
            !!record && record.active && record.tier === "pro" && !!record.stripeCustomerId;
        } catch (err) {
          request.log.error(err, "portal-request DB lookup failed");
          captureException(err, { source: "billing.portal-request.lookup" });
          isEligible = false;
        }
      }
      // Memory fallback intentionally NOT implemented: creating a Stripe
      // portal session requires a stripeCustomerId that only exists after
      // a real webhook run, which itself requires DB persistence. Local
      // dev without DATABASE_URL will always land in the generic-ok path.

      if (!isEligible) {
        return reply.send(genericOk);
      }

      const token = createBillingToken(email);
      const portalUrl = `${config.baseUrl}/manage-subscription?token=${encodeURIComponent(token)}`;

      const sendResult = await sendBillingPortalEmail(email, portalUrl);
      if (!sendResult.ok) {
        request.log.error(
          { email, requestId: request.id, smtpError: sendResult.error },
          "Failed to send billing portal email"
        );
      } else {
        request.log.info(
          { email, requestId: request.id, messageId: sendResult.error },
          "Billing portal email sent"
        );
      }

      return reply.send(genericOk);
    }
  );

  // ─── Confirm token, return a live Stripe Customer Portal URL ───
  // The frontend lands here after the user clicks the emailed link. We
  // verify the signed token, look up the Stripe customer ID, create a
  // fresh one-time portal session, and return the URL. The session URL
  // itself is short-lived (Stripe manages this) and is the actual
  // authenticator for the portal — our token just proves the requester
  // controls the email.
  app.post(
    "/api/billing/portal-confirm",
    { schema: { hide: true } },
    async (request, reply) => {
      const { token } = request.body as { token?: string };
      if (!token) {
        return reply.code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message: "Missing management token.",
        });
      }

      // Rate-limit per IP on the confirm step as cheap defense-in-depth
      // against HMAC brute force. The signature space is 2^256 so this is
      // pure belt-and-suspenders, not load-bearing.
      if (!checkBillingRateLimit(`confirm:${request.ip}`)) {
        return reply.code(429).send({
          error: "Too many requests",
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many attempts. Please try again later.",
        });
      }

      const result = verifyBillingToken(token);
      if (!result.ok || !result.email) {
        const msg =
          result.reason === "expired"
            ? "This management link has expired. Please request a new one."
            : "This management link is invalid.";
        return reply.code(400).send({
          error: "Invalid token",
          code: result.reason === "expired" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
          message: msg,
        });
      }

      if (!config.stripeSecretKey) {
        return reply.code(503).send({
          error: "Billing not configured",
          code: "BILLING_NOT_CONFIGURED",
          message: "Subscription management is not available.",
        });
      }

      const prisma = getPrisma();
      if (!prisma) {
        return reply.code(503).send({
          error: "Service unavailable",
          code: "DB_NOT_CONFIGURED",
          message: "Database not configured.",
        });
      }

      let customerId: string | null = null;
      try {
        const record = await prisma.apiKey.findUnique({
          where: { email: result.email },
        });
        customerId = record?.stripeCustomerId ?? null;
      } catch (err) {
        request.log.error(err, "portal-confirm DB lookup failed");
        captureException(err, { source: "billing.portal-confirm.lookup" });
        return reply.code(500).send({
          error: "Internal error",
          code: "INTERNAL_ERROR",
          message: "Unable to process request. Please try again later.",
        });
      }

      if (!customerId) {
        // Account was downgraded or revoked between token issue and use
        return reply.code(404).send({
          error: "Not found",
          code: "NO_SUBSCRIPTION",
          message: "No active subscription is associated with this email.",
        });
      }

      try {
        const stripe = getStripe();
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${config.baseUrl}/?billing=managed`,
        });

        request.log.info(
          { email: result.email, requestId: request.id },
          "Stripe billing portal session created"
        );

        return reply.send({
          portal_url: session.url,
        });
      } catch (err: any) {
        request.log.error(err, "Stripe billing portal session creation failed");
        captureException(err, { source: "billing.portal-confirm.stripe" });
        return reply.code(500).send({
          error: "Failed to open portal",
          code: "PORTAL_FAILED",
          message: "Unable to open subscription management. Please try again later.",
        });
      }
    }
  );
}
