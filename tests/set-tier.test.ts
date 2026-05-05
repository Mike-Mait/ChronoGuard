import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import {
  keysRoute,
  setTierByEmail,
  lookupKeyAsync,
} from "../src/routes/keys";

/**
 * Tests for the enterprise provisioning helper `setTierByEmail`.
 *
 * These tests deliberately don't configure a DATABASE_URL, so the function's
 * in-memory fallback path runs (DB path is exercised in production +
 * deploy-verification curl tests). The in-memory store is module-level state
 * shared across the whole test run, so each test uses a unique email to
 * avoid leaking state between cases.
 *
 * What we're proving:
 * - Returns ok:false for unknown emails (so the admin endpoint can 404 cleanly)
 * - Mutates tier + limit correctly
 * - Returns previous tier/limit for audit logging
 * - Resets requests_used + reset_at by default; preserves them with resetUsage:false
 * - Propagates the change into keyCache so the auth hot-path sees it on the
 *   next request without waiting for cache TTL
 * - Stripe customer ID gets attached when supplied (Stripe-billed enterprise
 *   accounts pair with a customer record)
 */
describe("setTierByEmail", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(keysRoute);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Create a fresh free-tier account in the in-memory store.
   *
   * Returns the raw API key so tests can call lookupKeyAsync(rawKey)
   * to verify cache propagation. Going through the route is the only
   * supported way to populate memoryKeyStore + memoryKeyIndex + keyCache
   * together — the internal createOrGetKey helper isn't exported.
   */
  async function createAccount(email: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/keys",
      payload: { email },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.api_key).toBeTruthy();
    return body.api_key as string;
  }

  it("returns ok:false when email doesn't exist", async () => {
    const result = await setTierByEmail(
      "ghost-set-tier-test@nowhere.invalid",
      "enterprise",
      5_000_000
    );
    expect(result.ok).toBe(false);
    expect(result.previousTier).toBeUndefined();
    expect(result.previousLimit).toBeUndefined();
  });

  it("upgrades free → enterprise with custom limit and returns previous values", async () => {
    const email = "set-tier-upgrade-free@example.test";
    await createAccount(email);

    const result = await setTierByEmail(email, "enterprise", 5_000_000);

    expect(result.ok).toBe(true);
    expect(result.previousTier).toBe("free");
    expect(result.previousLimit).toBe(1_000);
  });

  it("propagates new tier + limit into keyCache (auth hot-path sees it on next request)", async () => {
    const email = "set-tier-cache-propagation@example.test";
    const rawKey = await createAccount(email);

    await setTierByEmail(email, "enterprise", 5_000_000);

    const lookedUp = await lookupKeyAsync(rawKey);
    expect(lookedUp).not.toBeNull();
    expect(lookedUp!.tier).toBe("enterprise");
    expect(lookedUp!.requestsLimit).toBe(5_000_000);
  });

  it("resets requests_used to 0 by default (resetUsage: true is the default)", async () => {
    const email = "set-tier-reset-default@example.test";
    const rawKey = await createAccount(email);

    // Simulate prior usage. lookupKeyAsync returns the same KeyEntry
    // reference held in keyCache, so mutating it here is equivalent to the
    // server having served real requests through this key.
    const before = await lookupKeyAsync(rawKey);
    expect(before).not.toBeNull();
    before!.requestsUsed = 500;

    await setTierByEmail(email, "enterprise", 5_000_000);

    const after = await lookupKeyAsync(rawKey);
    expect(after!.requestsUsed).toBe(0);
  });

  it("preserves requests_used when resetUsage: false (mid-term limit bump)", async () => {
    const email = "set-tier-preserve-usage@example.test";
    const rawKey = await createAccount(email);

    const before = await lookupKeyAsync(rawKey);
    before!.requestsUsed = 750;

    await setTierByEmail(email, "enterprise", 5_000_000, {
      resetUsage: false,
    });

    const after = await lookupKeyAsync(rawKey);
    expect(after!.requestsUsed).toBe(750);
  });

  it("attaches stripe_customer_id when provided", async () => {
    const email = "set-tier-stripe-id@example.test";
    const rawKey = await createAccount(email);

    await setTierByEmail(email, "enterprise", 5_000_000, {
      stripeCustomerId: "cus_test_xyz",
    });

    const entry = await lookupKeyAsync(rawKey);
    expect(entry!.stripeCustomerId).toBe("cus_test_xyz");
  });

  it("does not touch stripe_customer_id when not provided", async () => {
    const email = "set-tier-no-stripe@example.test";
    const rawKey = await createAccount(email);

    await setTierByEmail(email, "enterprise", 5_000_000);

    const entry = await lookupKeyAsync(rawKey);
    // No customer ID was supplied, so this stays undefined — guards
    // against an accidental "" or null write that would later fail
    // Stripe portal lookups by truthy-but-invalid ID.
    expect(entry!.stripeCustomerId).toBeUndefined();
  });

  it("supports downgrade enterprise → free, returning previous enterprise values", async () => {
    const email = "set-tier-downgrade@example.test";
    await createAccount(email);

    // First promote to enterprise with a custom limit.
    const upgrade = await setTierByEmail(email, "enterprise", 5_000_000);
    expect(upgrade.ok).toBe(true);

    // Then downgrade. The returned previous values should reflect the
    // enterprise state, not the original free state — proving the helper
    // reports the IMMEDIATELY-prior values (useful for audit logs).
    const downgrade = await setTierByEmail(email, "free", 1_000);

    expect(downgrade.ok).toBe(true);
    expect(downgrade.previousTier).toBe("enterprise");
    expect(downgrade.previousLimit).toBe(5_000_000);
  });

  it("can adjust limit on an already-enterprise account without changing tier", async () => {
    const email = "set-tier-adjust-limit@example.test";
    const rawKey = await createAccount(email);

    await setTierByEmail(email, "enterprise", 5_000_000);
    const result = await setTierByEmail(email, "enterprise", 10_000_000, {
      resetUsage: false,
    });

    expect(result.ok).toBe(true);
    expect(result.previousTier).toBe("enterprise");
    expect(result.previousLimit).toBe(5_000_000);

    const entry = await lookupKeyAsync(rawKey);
    expect(entry!.tier).toBe("enterprise");
    expect(entry!.requestsLimit).toBe(10_000_000);
  });
});
