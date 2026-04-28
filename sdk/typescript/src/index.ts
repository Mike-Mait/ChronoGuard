// ─────────────────────────────────────────────────────────────────────────────
// ChronoShield TypeScript/JavaScript SDK
//
// Thin, dependency-free client for the ChronoShield API. Uses the global
// `fetch` (Node 18+ or any modern browser/runtime). No external runtime
// deps — your app's bundle stays small.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Request / Response shapes ──────────────────────────────────────────────

export interface ValidateRequest {
  local_datetime: string;
  time_zone: string;
}

export interface ValidateResponse {
  status: "valid" | "invalid" | "ambiguous";
  reason_code?: string;
  message?: string;
  suggested_fixes?: Array<{ strategy: string; local_datetime: string }>;
  possible_instants?: Array<{ offset: string; instant_utc: string }>;
}

export interface ResolveRequest {
  local_datetime: string;
  time_zone: string;
  resolution_policy?: {
    ambiguous?: "earlier" | "later" | "reject";
    invalid?: "next_valid_time" | "previous_valid_time" | "reject";
  };
}

export interface ResolveResponse {
  instant_utc: string;
  offset: string;
}

export interface ConvertRequest {
  instant_utc: string;
  target_time_zone: string;
}

export interface ConvertResponse {
  local_datetime: string;
  offset: string;
  time_zone: string;
}

export type BatchItem =
  | ({ operation: "validate" } & ValidateRequest)
  | ({ operation: "resolve" } & ResolveRequest)
  | ({ operation: "convert" } & ConvertRequest);

export interface BatchResultItem {
  index: number;
  operation: string;
  success: boolean;
  data?: ValidateResponse | ResolveResponse | ConvertResponse;
  error?: { message: string; code?: string };
}

export interface BatchResponse {
  results: BatchResultItem[];
  total: number;
  succeeded: number;
  failed: number;
}

/**
 * Response shape for `GET /v1/datetime/version`. Surfaces which IANA tzdata
 * release powers the API right now — useful for verifying which tzdb your
 * results were computed against (e.g., for reproducing historical results).
 */
export interface VersionResponse {
  /** IANA tzdata release version (e.g., "2026b"). Updated quarterly. */
  tzdb_version: string;
  /** The npm package providing the bundled tzdata. */
  tzdb_source: string;
  /** Version of that npm package (e.g., "0.6.2"). */
  tzdb_source_version: string;
  /** ChronoShield API version. */
  api_version: string;
}

/**
 * Rate limit state from the most recent API call. Populated from the
 * `X-RateLimit-*` response headers. `undefined` until the first call
 * completes.
 */
export interface RateLimitInfo {
  /** Total requests allowed in the current period. */
  limit: number;
  /** Requests remaining before hitting the limit. */
  remaining: number;
  /** When the count resets, as a JS Date. */
  resetAt: Date;
}

// ─── Error class ────────────────────────────────────────────────────────────

/**
 * Thrown by the SDK on any non-2xx response. Carries the structured fields
 * the API returns (`code`, `message`, optional `details`) plus the HTTP
 * status, so calling code can branch on machine-readable values without
 * parsing message strings.
 *
 * @example
 *   try {
 *     await client.validate({ local_datetime: "bad", time_zone: "X" });
 *   } catch (err) {
 *     if (err instanceof ChronoShieldError && err.code === "RATE_LIMIT_EXCEEDED") {
 *       // back off, queue, etc.
 *     } else {
 *       throw err;
 *     }
 *   }
 */
export class ChronoShieldError extends Error {
  /** HTTP status code from the response (e.g., 400, 401, 429, 500). */
  readonly status: number;
  /** Machine-readable error code from the API (e.g., "VALIDATION_FAILED"). */
  readonly code: string | undefined;
  /** Optional structured error details (e.g., AJV validation errors). */
  readonly details: unknown;
  /** Full parsed response body, for forward compatibility with new fields. */
  readonly body: unknown;

  constructor(opts: {
    status: number;
    message: string;
    code?: string;
    details?: unknown;
    body?: unknown;
  }) {
    super(opts.message);
    this.name = "ChronoShieldError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.body = opts.body;
  }
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class ChronoShieldClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  /**
   * Rate limit state from the most recent successful API call.
   * `undefined` until you make at least one call.
   */
  lastRateLimit: RateLimitInfo | undefined;

  constructor(options: { baseUrl?: string; apiKey: string }) {
    this.baseUrl = (options.baseUrl || "https://chronoshieldapi.com").replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  // ─── Datetime endpoints ───────────────────────────────────────────────────

  async validate(req: ValidateRequest): Promise<ValidateResponse> {
    return this.request<ValidateResponse>("POST", "/v1/datetime/validate", req);
  }

  async resolve(req: ResolveRequest): Promise<ResolveResponse> {
    return this.request<ResolveResponse>("POST", "/v1/datetime/resolve", req);
  }

  async convert(req: ConvertRequest): Promise<ConvertResponse> {
    return this.request<ConvertResponse>("POST", "/v1/datetime/convert", req);
  }

  async batch(items: BatchItem[]): Promise<BatchResponse> {
    return this.request<BatchResponse>("POST", "/v1/datetime/batch", { items });
  }

  /**
   * Returns the IANA tzdata version currently powering the API, plus the
   * underlying source package. No request body. Public endpoint — your API
   * key is not required for this call (but is sent if configured).
   */
  async getVersion(): Promise<VersionResponse> {
    return this.request<VersionResponse>("GET", "/v1/datetime/version");
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async request<T>(method: "GET" | "POST", endpoint: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, init);

    // Update rate limit state from response headers (when present — public
    // endpoints like /v1/datetime/version don't always include them).
    this.updateRateLimitFromHeaders(response.headers);

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const e = (parsed ?? {}) as {
        error?: string;
        code?: string;
        message?: string;
        details?: unknown;
      };
      throw new ChronoShieldError({
        status: response.status,
        message:
          e.message ||
          e.error ||
          `ChronoShield API error (HTTP ${response.status})`,
        code: e.code,
        details: e.details,
        body: parsed,
      });
    }

    return parsed as T;
  }

  private updateRateLimitFromHeaders(headers: Headers): void {
    const limit = headers.get("x-ratelimit-limit");
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    if (limit && remaining && reset) {
      this.lastRateLimit = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        resetAt: new Date(parseInt(reset, 10) * 1000),
      };
    }
  }
}
