/**
 * Thin fetch wrapper around the ChronoShield REST API.
 *
 * This MCP server is intentionally a translator, not a reimplementation —
 * every tool call corresponds to one HTTP request to chronoshieldapi.com.
 * Keeping it this way means tzdb updates and policy changes ship to MCP
 * users automatically without an npm publish.
 */

export interface ChronoShieldClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Per-request timeout in ms. Default 10000. */
  timeoutMs?: number;
}

export class ChronoShieldClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: ChronoShieldClientOptions) {
    if (!opts.apiKey) {
      throw new Error("ChronoShieldClient: apiKey is required");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://chronoshieldapi.com").replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  /**
   * Generic POST. We don't expose the raw `fetch` because every endpoint
   * needs the same auth header + timeout treatment, and keeping that in one
   * place avoids drift if we add retry / telemetry later.
   *
   * Errors are normalized so MCP clients see a consistent message shape:
   * `ChronoShield API error <status>: <body or statusText>`. We deliberately
   * do NOT include the API key or other request headers in the error string.
   */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // Non-JSON body — keep the raw text so the caller can surface it.
        parsed = text;
      }

      if (!response.ok) {
        const detail =
          typeof parsed === "object" && parsed !== null && "message" in parsed
            ? (parsed as { message?: string }).message
            : typeof parsed === "string"
              ? parsed
              : response.statusText;
        throw new Error(`ChronoShield API error ${response.status}: ${detail}`);
      }

      return parsed as T;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `ChronoShield API request timed out after ${this.timeoutMs}ms (${path})`
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  validate(input: { local_datetime: string; time_zone: string }) {
    return this.post<ValidateResponse>("/v1/datetime/validate", input);
  }

  resolve(input: {
    local_datetime: string;
    time_zone: string;
    resolution_policy?: {
      ambiguous?: "earlier" | "later" | "reject";
      invalid?: "next_valid_time" | "previous_valid_time" | "reject";
    };
  }) {
    return this.post<ResolveResponse>("/v1/datetime/resolve", input);
  }

  convert(input: { instant_utc: string; target_time_zone: string }) {
    return this.post<ConvertResponse>("/v1/datetime/convert", input);
  }

  batch(input: { items: BatchItem[] }) {
    return this.post<BatchResponse>("/v1/datetime/batch", input);
  }
}

// ─── Response types ───────────────────────────────────────────────────────
// These mirror the API's documented shape. We keep them loose (no enum
// narrowing on reason_code) so that future codes added server-side don't
// cause client-side type errors that block MCP users from upgrading.

export interface ValidateResponse {
  status: "valid" | "invalid" | "ambiguous";
  reason_code?: string;
  message?: string;
  suggested_fixes?: Array<{ strategy: string; local_datetime: string }>;
  possible_instants?: Array<{ offset: string; instant_utc: string }>;
}

export interface ResolveResponse {
  instant_utc: string;
  offset: string;
}

export interface ConvertResponse {
  local_datetime: string;
  offset: string;
  time_zone: string;
}

export type BatchItem =
  | {
      operation: "validate";
      local_datetime: string;
      time_zone: string;
    }
  | {
      operation: "resolve";
      local_datetime: string;
      time_zone: string;
      resolution_policy?: {
        ambiguous?: "earlier" | "later" | "reject";
        invalid?: "next_valid_time" | "previous_valid_time" | "reject";
      };
    }
  | {
      operation: "convert";
      instant_utc: string;
      target_time_zone: string;
    };

export interface BatchResponse {
  results: Array<
    | { index: number; operation: string; success: true; data: unknown }
    | {
        index: number;
        operation: string;
        success: false;
        error: { message: string; code?: string };
      }
  >;
  total: number;
  succeeded: number;
  failed: number;
}
