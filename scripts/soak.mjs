// ─────────────────────────────────────────────────────────────────────────────
// soak — end-to-end smoke + soak test against a running ChronoShield instance
//
// Usage:
//   BASE_URL=http://localhost:3000 npm run soak
//   BASE_URL=https://preview.railway.app API_KEY=xyz npm run soak
//   BASE_URL=...  ITERATIONS=50 INTERVAL_MS=2000 npm run soak  (soak mode)
//
// Env vars:
//   BASE_URL      Required. The instance to test against. No trailing slash.
//   API_KEY       Optional. If set, authenticated endpoints are tested too.
//                 Without it, only public endpoints are tested.
//   ITERATIONS    Optional. How many full smoke runs to do. Default: 1.
//                 Use ~30-60 with INTERVAL_MS for soak duration testing.
//   INTERVAL_MS   Optional. Sleep between iterations. Default: 0.
//
// Exits 0 on success, 1 on any test failure, 2 on usage error.
//
// What it tests:
//   - /health, /status (public)
//   - /v1/datetime/version (public, NEW post-cutover endpoint)
//   - /v1/datetime/validate × 5 cases (auth required)
//   - /v1/datetime/resolve × 3 cases (auth required)
//   - /v1/datetime/convert × 4 cases including BC permanent-DST verification
//
// Why this exists:
//   Vitest covers the unit/integration layer. This script covers the deployed
//   layer — verifying that what we built actually responds correctly when hit
//   over HTTP from outside the process. Catches deploy-only issues like
//   missing env vars, DB connectivity, reverse proxy config, etc.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "");
const API_KEY = process.env.API_KEY;
const ITERATIONS = parseInt(process.env.ITERATIONS ?? "1", 10);
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? "0", 10);

if (!BASE_URL) {
  console.error("✗ BASE_URL env var required (e.g., BASE_URL=http://localhost:3000)");
  process.exitCode = 2;
}

// ─── Test definitions ───────────────────────────────────────────────────────

const PUBLIC_TESTS = [
  {
    name: "GET /health",
    request: { method: "GET", path: "/health" },
    expect: (status, body) => status === 200 && body.status === "ok",
  },
  {
    name: "GET /status",
    request: { method: "GET", path: "/status" },
    expect: (status, body) =>
      status === 200 &&
      body.status === "operational" &&
      // Verify the cleanup actually shipped — timezone_data should be GONE
      body.timezone_data === undefined &&
      // Verify the new endpoint is in the catalog
      body.endpoints?.version === "/v1/datetime/version",
  },
  {
    name: "GET /v1/datetime/version (tzdb=2026b expected)",
    request: { method: "GET", path: "/v1/datetime/version" },
    expect: (status, body) =>
      status === 200 &&
      body.tzdb_version === "2026b" &&
      body.tzdb_source === "moment-timezone" &&
      typeof body.tzdb_source_version === "string" &&
      typeof body.api_version === "string",
  },
];

const AUTH_TESTS = [
  // ─── /validate ───
  {
    name: "POST /v1/datetime/validate — normal time",
    request: {
      method: "POST",
      path: "/v1/datetime/validate",
      body: { local_datetime: "2026-06-15T12:00:00", time_zone: "America/New_York" },
    },
    expect: (status, body) => status === 200 && body.status === "valid",
  },
  {
    name: "POST /v1/datetime/validate — DST gap (NY 2026-03-08 02:30)",
    request: {
      method: "POST",
      path: "/v1/datetime/validate",
      body: { local_datetime: "2026-03-08T02:30:00", time_zone: "America/New_York" },
    },
    expect: (status, body) =>
      status === 200 && body.status === "invalid" && body.reason_code === "DST_GAP",
  },
  {
    name: "POST /v1/datetime/validate — DST overlap (NY 2026-11-01 01:30)",
    request: {
      method: "POST",
      path: "/v1/datetime/validate",
      body: { local_datetime: "2026-11-01T01:30:00", time_zone: "America/New_York" },
    },
    expect: (status, body) =>
      status === 200 &&
      body.status === "ambiguous" &&
      body.reason_code === "DST_OVERLAP" &&
      body.possible_instants?.length === 2,
  },
  {
    name: "POST /v1/datetime/validate — Lord Howe 30-min DST gap",
    request: {
      method: "POST",
      path: "/v1/datetime/validate",
      body: { local_datetime: "2026-10-04T02:15:00", time_zone: "Australia/Lord_Howe" },
    },
    expect: (status, body) =>
      status === 200 && body.status === "invalid" && body.reason_code === "DST_GAP",
  },
  {
    name: "POST /v1/datetime/validate — Kathmandu (+5:45) normal",
    request: {
      method: "POST",
      path: "/v1/datetime/validate",
      body: { local_datetime: "2026-06-15T15:00:00", time_zone: "Asia/Kathmandu" },
    },
    expect: (status, body) => status === 200 && body.status === "valid",
  },

  // ─── /resolve ───
  {
    name: "POST /v1/datetime/resolve — normal time",
    request: {
      method: "POST",
      path: "/v1/datetime/resolve",
      body: { local_datetime: "2026-06-15T12:00:00", time_zone: "America/New_York" },
    },
    expect: (status, body) =>
      status === 200 &&
      body.instant_utc === "2026-06-15T16:00:00.000Z" &&
      body.offset === "-04:00",
  },
  {
    name: "POST /v1/datetime/resolve — gap with next_valid_time",
    request: {
      method: "POST",
      path: "/v1/datetime/resolve",
      body: {
        local_datetime: "2026-03-08T02:30:00",
        time_zone: "America/New_York",
        resolution_policy: { ambiguous: "earlier", invalid: "next_valid_time" },
      },
    },
    expect: (status, body) =>
      status === 200 && body.instant_utc === "2026-03-08T07:00:00.000Z",
  },
  {
    name: "POST /v1/datetime/resolve — overlap with earlier",
    request: {
      method: "POST",
      path: "/v1/datetime/resolve",
      body: {
        local_datetime: "2026-11-01T01:30:00",
        time_zone: "America/New_York",
        resolution_policy: { ambiguous: "earlier", invalid: "next_valid_time" },
      },
    },
    expect: (status, body) =>
      status === 200 && body.instant_utc === "2026-11-01T05:30:00.000Z",
  },

  // ─── /convert ───
  {
    name: "POST /v1/datetime/convert — UTC → NY (summer EDT)",
    request: {
      method: "POST",
      path: "/v1/datetime/convert",
      body: { instant_utc: "2026-06-15T15:00:00Z", target_time_zone: "America/New_York" },
    },
    expect: (status, body) =>
      status === 200 &&
      body.local_datetime === "2026-06-15T11:00:00" &&
      body.offset === "-04:00",
  },
  {
    name: "POST /v1/datetime/convert — UTC → Kathmandu (+5:45)",
    request: {
      method: "POST",
      path: "/v1/datetime/convert",
      body: { instant_utc: "2026-06-15T15:00:00Z", target_time_zone: "Asia/Kathmandu" },
    },
    expect: (status, body) =>
      status === 200 && body.local_datetime === "2026-06-15T20:45:00" && body.offset === "+05:45",
  },
  {
    // CRITICAL: this verifies the BC permanent-DST behavior change is live
    // post-cutover. If this fails with -08:00, the cutover did NOT actually
    // happen on this instance — production is still on Luxon+ICU.
    name: "POST /v1/datetime/convert — Vancouver Dec 2026 (BC permanent-DST → -07:00)",
    request: {
      method: "POST",
      path: "/v1/datetime/convert",
      body: { instant_utc: "2026-12-15T20:00:00Z", target_time_zone: "America/Vancouver" },
    },
    expect: (status, body) =>
      status === 200 && body.offset === "-07:00",
  },
  {
    name: "POST /v1/datetime/convert — invalid zone returns 4xx",
    request: {
      method: "POST",
      path: "/v1/datetime/convert",
      body: { instant_utc: "2026-06-15T15:00:00Z", target_time_zone: "Fake/Atlantis" },
    },
    expect: (status) => status >= 400 && status < 500,
  },
];

// ─── Runner ─────────────────────────────────────────────────────────────────

async function runOne(test) {
  const url = `${BASE_URL}${test.request.path}`;
  const start = performance.now();
  const init = {
    method: test.request.method,
    headers: { "Content-Type": "application/json" },
  };
  if (API_KEY && test.request.path.startsWith("/v1/")) {
    init.headers["x-api-key"] = API_KEY;
  }
  if (test.request.body !== undefined) {
    init.body = JSON.stringify(test.request.body);
  }
  let res, body, err;
  try {
    res = await fetch(url, init);
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } catch (e) {
    err = e;
  }
  const ms = Math.round(performance.now() - start);
  const ok = !err && test.expect(res.status, body);
  return { test, ok, status: res?.status, body, err, ms };
}

function fmtResult(r) {
  const status = r.ok ? "✓" : "✗";
  const time = `${r.ms}ms`.padStart(6);
  const httpCode = r.status ?? "ERR";
  let line = `  ${status} ${time} ${String(httpCode).padStart(3)} ${r.test.name}`;
  if (!r.ok) {
    if (r.err) {
      line += `\n      error: ${r.err.message}`;
    } else {
      const sample =
        typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 200) : String(r.body).slice(0, 200);
      line += `\n      body: ${sample}`;
    }
  }
  return line;
}

async function main() {
  console.log(`\nSoak target: ${BASE_URL}`);
  console.log(`API key: ${API_KEY ? "provided (auth tests enabled)" : "not provided (public tests only)"}`);
  console.log(`Iterations: ${ITERATIONS}, interval: ${INTERVAL_MS}ms\n`);

  const tests = [...PUBLIC_TESTS, ...(API_KEY ? AUTH_TESTS : [])];
  let totalPass = 0;
  let totalFail = 0;
  const allTimings = [];

  for (let iter = 1; iter <= ITERATIONS; iter++) {
    if (ITERATIONS > 1) console.log(`── Iteration ${iter}/${ITERATIONS} ──`);
    let iterPass = 0;
    let iterFail = 0;
    for (const test of tests) {
      const r = await runOne(test);
      if (r.ok) {
        iterPass++;
        allTimings.push(r.ms);
        if (ITERATIONS === 1) console.log(fmtResult(r));
      } else {
        iterFail++;
        console.log(fmtResult(r));
      }
    }
    totalPass += iterPass;
    totalFail += iterFail;
    if (ITERATIONS > 1) {
      console.log(`  iter ${iter}: ${iterPass} pass / ${iterFail} fail`);
    }
    if (iter < ITERATIONS && INTERVAL_MS > 0) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  // Summary
  const total = totalPass + totalFail;
  console.log(`\n─── Summary ───`);
  console.log(`Total checks: ${total}  (${totalPass} pass, ${totalFail} fail)`);
  if (allTimings.length > 0) {
    const sorted = [...allTimings].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const max = sorted[sorted.length - 1];
    console.log(`Latency: p50=${p50}ms  p95=${p95}ms  max=${max}ms`);
  }
  if (totalFail > 0) {
    console.log(`\n✗ ${totalFail} check(s) FAILED — do not promote this build.`);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ All checks passed.`);
  }
}

if (BASE_URL) {
  main().catch((err) => {
    console.error("✗ Unexpected error:", err);
    process.exitCode = 1;
  });
}
