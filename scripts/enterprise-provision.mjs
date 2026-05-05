#!/usr/bin/env node
/**
 * Enterprise provisioning helper.
 *
 * Wraps POST /api/admin/keys/set-tier so you don't have to remember the
 * endpoint shape, type the SQL UPDATE from playbook §5.1 by hand, or
 * worry about firing the welcome email separately. Mirrors the playbook
 * §5.1/§5.2 flow but adds:
 *   - Input validation (catches typos before they hit the DB)
 *   - Auto-fires the welcome email on new enterprise promotions
 *   - Pretty-printed before/after diff so you can paste it into the deal tracker
 *
 * Run from anywhere with the master API key — works against production or
 * a local dev server. Does NOT need direct DB access.
 *
 * Usage:
 *   node scripts/enterprise-provision.mjs \
 *     --email customer@example.com \
 *     --limit 5000000 \
 *     [--tier enterprise]              (default: enterprise)
 *     [--company "Acme Inc"]           (used in welcome-email greeting)
 *     [--no-email]                     (skip the auto welcome email)
 *     [--no-reset-usage]               (preserve current month's usage counter)
 *     [--base-url https://chronoshieldapi.com]
 *
 * Env (alternatives to --base-url and the master key):
 *   CHRONOSHIELD_API_KEY     master admin key (required, also: --api-key)
 *   CHRONOSHIELD_BASE_URL    defaults to https://chronoshieldapi.com
 *
 * Exit codes:
 *   0  success
 *   1  validation error (bad args, missing key, etc.)
 *   2  customer not found (their free account doesn't exist yet)
 *   3  HTTP error from the API (auth, server-side, etc.)
 */

const args = process.argv.slice(2);

function getFlag(name, fallback = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = args[idx + 1];
  if (value === undefined || value.startsWith("--")) {
    // Boolean flag: presence alone means true
    return true;
  }
  return value;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

if (hasFlag("help") || hasFlag("h") || args.length === 0) {
  console.log(`
Enterprise provisioning helper for ChronoShield API.

Usage:
  node scripts/enterprise-provision.mjs --email <email> --limit <n> [options]

Required:
  --email <email>          Customer's account email (must already exist as a free tier)
  --limit <n>              Monthly request limit (positive integer, e.g. 5000000)

Options:
  --tier <tier>            Tier to set: free | pro | enterprise  (default: enterprise)
  --company <name>         Company name for the welcome email greeting
  --no-email               Skip the welcome email
  --no-reset-usage         Preserve current month's request counter (default: reset to 0)
  --stripe-customer <id>   Attach a Stripe customer ID (optional)
  --base-url <url>         Override the API base URL
  --api-key <key>          Master admin key (or set CHRONOSHIELD_API_KEY env var)
  --dry-run                Print the request body without sending it
  --help, -h               Show this message

Examples:
  # Standard enterprise provision
  node scripts/enterprise-provision.mjs \\
    --email ops@acme.com --limit 5000000 --company "Acme Inc"

  # Mid-month limit bump (don't reset usage)
  node scripts/enterprise-provision.mjs \\
    --email ops@acme.com --limit 10000000 --no-reset-usage --no-email
`);
  process.exit(args.length === 0 ? 1 : 0);
}

const email = getFlag("email");
const limitRaw = getFlag("limit");
const tier = getFlag("tier", "enterprise");
const company = getFlag("company");
const sendEmail = !hasFlag("no-email");
const resetUsage = !hasFlag("no-reset-usage");
const stripeCustomerId = getFlag("stripe-customer");
const dryRun = hasFlag("dry-run");
const baseUrl = (
  getFlag("base-url") ||
  process.env.CHRONOSHIELD_BASE_URL ||
  "https://chronoshieldapi.com"
).replace(/\/$/, "");
const apiKey = getFlag("api-key") || process.env.CHRONOSHIELD_API_KEY;

// Input validation — fail loudly with specific messages so a typo'd
// argument doesn't get masked as a generic 400 from the API.
const errors = [];
if (!email) errors.push("--email is required");
else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  errors.push(`--email "${email}" is not a valid email address`);

if (limitRaw === undefined) errors.push("--limit is required");
const limit = Number(limitRaw);
if (
  limitRaw !== undefined &&
  (!Number.isInteger(limit) || limit < 1 || limit > 1_000_000_000)
) {
  errors.push(
    `--limit must be a positive integer between 1 and 1,000,000,000 (got "${limitRaw}")`
  );
}

if (!["free", "pro", "enterprise"].includes(tier)) {
  errors.push(`--tier must be one of: free, pro, enterprise (got "${tier}")`);
}

if (!apiKey && !dryRun) {
  errors.push(
    "Master admin key required. Set CHRONOSHIELD_API_KEY env var or pass --api-key <key>"
  );
}

if (errors.length > 0) {
  console.error("Errors:");
  for (const e of errors) console.error("  •", e);
  console.error("\nRun with --help for usage.");
  process.exit(1);
}

const body = {
  email,
  tier,
  requests_limit: limit,
  reset_usage: resetUsage,
  send_welcome_email: sendEmail,
  ...(company && { company_name: company }),
  ...(stripeCustomerId && { stripe_customer_id: stripeCustomerId }),
};

if (dryRun) {
  console.log("[dry-run] Would POST to:", `${baseUrl}/api/admin/keys/set-tier`);
  console.log("[dry-run] Body:");
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

console.log(`→ ${baseUrl}/api/admin/keys/set-tier`);
console.log(`  email:           ${email}`);
console.log(`  tier:            ${tier}`);
console.log(`  requests_limit:  ${limit.toLocaleString("en-US")}`);
console.log(`  reset_usage:     ${resetUsage}`);
console.log(`  send_welcome:    ${sendEmail}`);
if (company) console.log(`  company_name:    ${company}`);
if (stripeCustomerId) console.log(`  stripe_customer: ${stripeCustomerId}`);
console.log();

let response;
try {
  response = await fetch(`${baseUrl}/api/admin/keys/set-tier`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
} catch (err) {
  console.error("✗ Network error:", err.message);
  process.exit(3);
}

const responseText = await response.text();
let data;
try {
  data = JSON.parse(responseText);
} catch {
  data = { rawBody: responseText };
}

if (response.status === 404) {
  console.error("✗ Customer not found.");
  console.error(
    "  The customer must create a free account at the landing page before you can upgrade them."
  );
  console.error("  Send them: " + baseUrl + " — they enter their email and get a key.");
  console.error("  Then re-run this script.");
  process.exit(2);
}

if (!response.ok) {
  console.error(`✗ HTTP ${response.status}: ${data.error || responseText}`);
  if (data.message) console.error(`  ${data.message}`);
  process.exit(3);
}

console.log("✓ Tier set successfully.");
console.log();
console.log("  Before: tier=" + (data.previous_tier || "?") + ", limit=" + (data.previous_limit?.toLocaleString("en-US") || "?"));
console.log("  After:  tier=" + data.tier + ", limit=" + data.requests_limit.toLocaleString("en-US"));
if (data.welcome_email_sent !== undefined) {
  console.log("  Welcome email: " + (data.welcome_email_sent ? "sent ✓" : "skipped"));
}
console.log();
console.log("Next steps (from the playbook):");
console.log("  1. Run §5.2 SELECT in Railway console to confirm the row");
console.log("  2. Update the deal tracker (§11): record monthly price, term, renewal date");
console.log("  3. Send the personalized integration-call offer if >$10K/yr");
