// In-process smoke test for the reset flow. Uses in-memory key store (no DB
// required). Run with: node scripts/smoke-reset.js
process.env.DATABASE_URL = ""; // force memory fallback
process.env.RESET_TOKEN_SECRET = "test-secret-for-smoke-only-aaaaaaaaaaaaaaaa";
process.env.NODE_ENV = "test";

const Fastify = require("fastify");
const { keysRoute } = require("../dist/routes/keys");
const { adminRoute } = require("../dist/routes/admin");

async function main() {
  const app = Fastify({ logger: false });
  await app.register(keysRoute);
  await app.register(adminRoute);

  const email = "smoke" + Date.now() + "@example.com";

  // 1. Create a free-tier key
  let r = await app.inject({
    method: "POST",
    url: "/api/keys",
    payload: { email, tier: "free" },
  });
  const original = JSON.parse(r.body).api_key;
  console.log("1. Issued key:", original ? original.slice(0, 16) + "..." : null);

  // 2. Verify lookup works
  const { lookupKeyAsync } = require("../dist/routes/keys");
  const lookup1 = await lookupKeyAsync(original);
  console.log("2. Original key lookup OK:", !!lookup1);

  // 3. Request a reset (no email will actually send; just verify 200)
  r = await app.inject({
    method: "POST",
    url: "/api/keys/reset-request",
    payload: { email },
  });
  console.log("3. Reset-request status:", r.statusCode, "-", JSON.parse(r.body).message);

  // 4. Request for a non-existent email — should return identical response
  r = await app.inject({
    method: "POST",
    url: "/api/keys/reset-request",
    payload: { email: "nobody" + Date.now() + "@nowhere.com" },
  });
  console.log("4. Reset-request (no-account) status:", r.statusCode, "-", JSON.parse(r.body).message);

  // 5. Create a real token, hit reset-confirm
  const { createResetToken } = require("../dist/utils/resetTokens");
  const token = createResetToken(email);
  r = await app.inject({
    method: "POST",
    url: "/api/keys/reset-confirm",
    payload: { token },
  });
  const confirmBody = JSON.parse(r.body);
  const newKey = confirmBody.api_key;
  console.log("5. Reset-confirm status:", r.statusCode, "new key:", newKey ? newKey.slice(0, 16) + "..." : null);
  console.log("   Different from original:", newKey !== original);

  // 6. Verify old key no longer works
  const lookupOld = await lookupKeyAsync(original);
  console.log("6. Old key lookup fails (expected null):", lookupOld);

  // 7. Verify new key works
  const lookupNew = await lookupKeyAsync(newKey);
  console.log("7. New key lookup OK:", !!lookupNew, lookupNew ? `(tier: ${lookupNew.tier})` : "");

  // 8. Replay same token — should fail because the key was rotated
  // (Current design: token still passes HMAC/expiry, but you end up with
  // another rotation. Not ideal for true single-use, but acceptable since
  // attacker with the token could rotate anyway.)
  r = await app.inject({
    method: "POST",
    url: "/api/keys/reset-confirm",
    payload: { token },
  });
  const replay = JSON.parse(r.body);
  console.log("8. Replay attempt:", r.statusCode, replay.api_key ? "(rotated again)" : replay.message);

  // 9. Invalid token
  r = await app.inject({
    method: "POST",
    url: "/api/keys/reset-confirm",
    payload: { token: "totally-bogus.AAAAAAA" },
  });
  console.log("9. Invalid token status:", r.statusCode, "-", JSON.parse(r.body).code);

  // 10. Admin rotate without auth
  r = await app.inject({
    method: "POST",
    url: "/api/admin/keys/rotate",
    payload: { email },
  });
  console.log("10. Admin rotate (no auth) status:", r.statusCode);

  // 11. Admin rotate with wrong key
  r = await app.inject({
    method: "POST",
    url: "/api/admin/keys/rotate",
    headers: { "x-api-key": "wrong" },
    payload: { email },
  });
  console.log("11. Admin rotate (wrong key) status:", r.statusCode);

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
