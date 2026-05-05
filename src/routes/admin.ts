import { FastifyInstance } from "fastify";
import { config } from "../config/env";
import { getPrisma } from "../db/client";
import { rotateKeyByEmail, setTierByEmail, type Tier } from "./keys";
import { sendWelcomeEnterpriseEmail } from "../utils/email";

const VALID_TIERS: Tier[] = ["free", "pro", "enterprise"];

function isAdminAuthorized(request: any): boolean {
  const apiKey = request.headers["x-api-key"] as string | undefined;
  return !!(config.apiKey && apiKey === config.apiKey);
}

export async function adminRoute(app: FastifyInstance) {
  // Revoke (deactivate) an API key by email
  app.post(
    "/api/admin/keys/revoke",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!isAdminAuthorized(request)) {
        return reply.code(403).send({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "Admin access required.",
        });
      }

      const { email } = request.body as { email?: string };
      if (!email) {
        return reply.code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message: "Email is required.",
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

      try {
        const record = await prisma.apiKey.findUnique({ where: { email } });
        if (!record) {
          return reply.code(404).send({
            error: "Not found",
            code: "KEY_NOT_FOUND",
            message: "No API key found for this email.",
          });
        }

        if (!record.active) {
          return reply.send({
            email,
            active: false,
            message: "Key is already revoked.",
          });
        }

        await prisma.apiKey.update({
          where: { email },
          data: { active: false },
        });

        request.log.info({ email, requestId: request.id }, "API key revoked by admin");
        return reply.send({
          email,
          active: false,
          message: "API key has been revoked.",
        });
      } catch (err) {
        request.log.error(err, "Failed to revoke API key");
        return reply.code(500).send({
          error: "Internal error",
          code: "INTERNAL_ERROR",
          message: "Failed to revoke key.",
        });
      }
    }
  );

  // Reactivate an API key by email
  app.post(
    "/api/admin/keys/activate",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!isAdminAuthorized(request)) {
        return reply.code(403).send({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "Admin access required.",
        });
      }

      const { email } = request.body as { email?: string };
      if (!email) {
        return reply.code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message: "Email is required.",
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

      try {
        const record = await prisma.apiKey.findUnique({ where: { email } });
        if (!record) {
          return reply.code(404).send({
            error: "Not found",
            code: "KEY_NOT_FOUND",
            message: "No API key found for this email.",
          });
        }

        if (record.active) {
          return reply.send({
            email,
            active: true,
            message: "Key is already active.",
          });
        }

        await prisma.apiKey.update({
          where: { email },
          data: { active: true },
        });

        request.log.info({ email, requestId: request.id }, "API key activated by admin");
        return reply.send({
          email,
          active: true,
          message: "API key has been reactivated.",
        });
      } catch (err) {
        request.log.error(err, "Failed to activate API key");
        return reply.code(500).send({
          error: "Internal error",
          code: "INTERNAL_ERROR",
          message: "Failed to activate key.",
        });
      }
    }
  );

  // List all API keys (admin overview)
  app.get(
    "/api/admin/keys",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!isAdminAuthorized(request)) {
        return reply.code(403).send({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "Admin access required.",
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

      try {
        // Include the all-time request_logs row count per key so the admin
        // overview can surface real traffic volume, not just the in-month
        // counter (which resets monthly). Useful for quickly spotting
        // dormant accounts vs. heavy users at a glance. Prisma's _count
        // relation aggregator runs as a single grouped query — not N+1.
        const keys = await prisma.apiKey.findMany({
          select: {
            id: true,
            email: true,
            tier: true,
            active: true,
            requestsUsed: true,
            requestsLimit: true,
            stripeCustomerId: true,
            resetAt: true,
            createdAt: true,
            _count: {
              select: { requestLogs: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        // Flatten _count.requestLogs to a top-level request_logs_count for
        // simpler consumer code (admin scripts, dashboards). Hides the
        // Prisma-specific shape from the wire format.
        const flattened = keys.map((k) => {
          const { _count, ...rest } = k;
          return { ...rest, request_logs_count: _count?.requestLogs ?? 0 };
        });

        return reply.send({ count: flattened.length, keys: flattened });
      } catch (err) {
        request.log.error(err, "Failed to list API keys");
        return reply.code(500).send({
          error: "Internal error",
          code: "INTERNAL_ERROR",
          message: "Failed to list keys.",
        });
      }
    }
  );

  // Set a key's tier and request limit. Used for enterprise provisioning
  // (the playbook's §5.1 SQL UPDATE, but routed through code so we get
  // logging, the welcome email, and request-log audit trail for free).
  //
  // Auth: master API key (same as the other admin endpoints).
  // Email: sent automatically when tier === "enterprise" unless
  //   send_welcome_email === false in the body. For free/pro tier moves,
  //   no email fires by default — those should normally happen via the
  //   self-serve Stripe flow, not this endpoint.
  app.post(
    "/api/admin/keys/set-tier",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!isAdminAuthorized(request)) {
        return reply.code(403).send({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "Admin access required.",
        });
      }

      const body = request.body as {
        email?: string;
        tier?: string;
        requests_limit?: number;
        reset_usage?: boolean;
        stripe_customer_id?: string;
        send_welcome_email?: boolean;
        company_name?: string;
      };

      const { email, tier, requests_limit } = body;

      if (!email || !tier || typeof requests_limit !== "number") {
        return reply.code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message:
            "email (string), tier (string), and requests_limit (number) are required.",
        });
      }

      if (!VALID_TIERS.includes(tier as Tier)) {
        return reply.code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message: `tier must be one of: ${VALID_TIERS.join(", ")}.`,
        });
      }

      // Guardrails on requests_limit: must be a positive integer. Catching
      // floats and negatives here prevents a typo'd payload (e.g. -5000000
      // or 5e6.5) from persisting nonsense into the DB and breaking the
      // rate-limit check, which compares with `>=`.
      if (
        !Number.isInteger(requests_limit) ||
        requests_limit < 1 ||
        requests_limit > 1_000_000_000
      ) {
        return reply.code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message:
            "requests_limit must be a positive integer between 1 and 1,000,000,000.",
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

      try {
        const result = await setTierByEmail(
          email,
          tier as Tier,
          requests_limit,
          {
            resetUsage: body.reset_usage !== false,
            stripeCustomerId: body.stripe_customer_id,
          }
        );

        if (!result.ok) {
          return reply.code(404).send({
            error: "Not found",
            code: "KEY_NOT_FOUND",
            message:
              "No API key found for this email. The customer must create a free account at the landing page first.",
          });
        }

        // Welcome email logic:
        //   - Only the enterprise welcome template exists at the moment, so
        //     sending an email at all only makes sense when tier === "enterprise".
        //   - Default: send only when this is a NEW enterprise promotion
        //     (previousTier !== "enterprise"). Limit-bumps on an already-
        //     enterprise account skip the email — second "welcome" message
        //     in 90 days reads as a CRM bug.
        //   - Override: send_welcome_email in the body forces either way.
        //     Caller might explicitly want to resend the welcome (e.g. the
        //     first one bounced) or suppress it (e.g. corrected a typo).
        const isNewEnterprisePromotion =
          tier === "enterprise" && result.previousTier !== "enterprise";

        const shouldSendEmail =
          tier === "enterprise" &&
          (body.send_welcome_email !== undefined
            ? body.send_welcome_email
            : isNewEnterprisePromotion);

        let welcomeEmailSent = false;
        if (shouldSendEmail) {
          welcomeEmailSent = await sendWelcomeEnterpriseEmail(
            email,
            requests_limit,
            { companyName: body.company_name }
          );
          if (!welcomeEmailSent) {
            request.log.warn(
              { email, requestId: request.id },
              "Enterprise welcome email failed to send (tier change still applied)"
            );
          }
        }

        request.log.info(
          {
            email,
            previousTier: result.previousTier,
            newTier: tier,
            previousLimit: result.previousLimit,
            newLimit: requests_limit,
            welcomeEmailSent,
            requestId: request.id,
          },
          "Tier set by admin"
        );

        return reply.send({
          email,
          tier,
          requests_limit,
          previous_tier: result.previousTier,
          previous_limit: result.previousLimit,
          welcome_email_sent: welcomeEmailSent,
          message: `Tier set to ${tier} with ${requests_limit.toLocaleString(
            "en-US"
          )} req/mo.`,
        });
      } catch (err) {
        request.log.error(err, "Failed to set tier");
        return reply.code(500).send({
          error: "Internal error",
          code: "INTERNAL_ERROR",
          message: "Failed to set tier.",
        });
      }
    }
  );

  // Rotate (regenerate) an API key by email. Used for support handoff when a
  // customer has lost their key and verified their identity out-of-band.
  // Returns the new raw key so support can send it to the verified owner.
  app.post(
    "/api/admin/keys/rotate",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!isAdminAuthorized(request)) {
        return reply.code(403).send({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "Admin access required.",
        });
      }

      const { email } = request.body as { email?: string };
      if (!email) {
        return reply.code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message: "Email is required.",
        });
      }

      try {
        const newKey = await rotateKeyByEmail(email);
        if (!newKey) {
          return reply.code(404).send({
            error: "Not found",
            code: "KEY_NOT_FOUND",
            message: "No API key found for this email.",
          });
        }

        request.log.info(
          { email, requestId: request.id },
          "API key rotated by admin"
        );

        return reply.send({
          email,
          api_key: newKey,
          message:
            "New key issued. The previous key is now invalid — share this key with the verified owner securely.",
        });
      } catch (err) {
        request.log.error(err, "Failed to rotate API key");
        return reply.code(500).send({
          error: "Internal error",
          code: "INTERNAL_ERROR",
          message: "Failed to rotate key.",
        });
      }
    }
  );
}
