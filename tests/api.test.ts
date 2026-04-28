import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { validateRoute } from "../src/routes/validate";
import { resolveRoute } from "../src/routes/resolve";
import { convertRoute } from "../src/routes/convert";
import { versionRoute } from "../src/routes/version";

describe("API Integration Tests", () => {
  const app = Fastify();

  beforeAll(async () => {
    await app.register(validateRoute);
    await app.register(resolveRoute);
    await app.register(convertRoute);
    await app.register(versionRoute);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /v1/datetime/validate", () => {
    it("returns invalid for DST gap", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/datetime/validate",
        payload: {
          local_datetime: "2026-03-08T02:30:00",
          time_zone: "America/New_York",
        },
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.status).toBe("invalid");
      expect(body.reason_code).toBe("DST_GAP");
    });

    it("returns valid for normal time", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/datetime/validate",
        payload: {
          local_datetime: "2026-06-15T12:00:00",
          time_zone: "America/New_York",
        },
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.status).toBe("valid");
    });

    it("returns 400 for missing fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/datetime/validate",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /v1/datetime/resolve", () => {
    it("resolves a normal time", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/datetime/resolve",
        payload: {
          local_datetime: "2026-06-15T12:00:00",
          time_zone: "America/New_York",
        },
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.instant_utc).toBe("2026-06-15T16:00:00.000Z");
      expect(body.offset).toBe("-04:00");
    });
  });

  describe("POST /v1/datetime/convert", () => {
    it("converts UTC to target timezone", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/datetime/convert",
        payload: {
          instant_utc: "2026-06-15T15:00:00Z",
          target_time_zone: "Europe/London",
        },
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.local_datetime).toBe("2026-06-15T16:00:00");
      expect(body.offset).toBe("+01:00");
      expect(body.time_zone).toBe("Europe/London");
    });
  });

  describe("GET /v1/datetime/version", () => {
    it("returns the bundled tzdata version and source", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/datetime/version",
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      // Version format: 4 digits + 1+ lowercase letters (e.g., "2026b")
      expect(body.tzdb_version).toMatch(/^\d{4}[a-z]+$/);
      expect(body.tzdb_source).toBe("moment-timezone");
      // Semver-ish — at least one dot, all-numeric segments
      expect(body.tzdb_source_version).toMatch(/^\d+\.\d+/);
      expect(body.api_version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
