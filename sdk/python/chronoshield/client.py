"""ChronoShield API Python SDK."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional


# ─── Response dataclasses ────────────────────────────────────────────────────


@dataclass
class ValidateResponse:
    status: str
    reason_code: Optional[str] = None
    message: Optional[str] = None
    suggested_fixes: Optional[list[dict[str, str]]] = None
    possible_instants: Optional[list[dict[str, str]]] = None


@dataclass
class ResolveResponse:
    instant_utc: str
    offset: str


@dataclass
class ConvertResponse:
    local_datetime: str
    offset: str
    time_zone: str


@dataclass
class VersionResponse:
    """Response shape for ``GET /v1/datetime/version``.

    Surfaces which IANA tzdata release powers the API right now — useful for
    verifying which tzdb your results were computed against (e.g., for
    reproducing historical results).
    """

    tzdb_version: str
    tzdb_source: str
    tzdb_source_version: str
    api_version: str


@dataclass
class RateLimitInfo:
    """Rate limit state from the most recent API call.

    Populated from the ``X-RateLimit-*`` response headers. ``None`` until
    the first authenticated call completes.
    """

    limit: int
    remaining: int
    reset_at: datetime


# ─── Error class ─────────────────────────────────────────────────────────────


class ChronoShieldError(Exception):
    """Raised for any non-2xx response from the ChronoShield API.

    Carries the structured fields the API returns (``code``, ``message``,
    optional ``details``) plus the HTTP status, so calling code can branch
    on machine-readable values without parsing message strings.

    Example::

        try:
            client.validate("bad", "Invalid/Zone")
        except ChronoShieldError as e:
            if e.code == "RATE_LIMIT_EXCEEDED":
                # back off, queue, etc.
                ...
    """

    def __init__(
        self,
        status: int,
        message: str,
        code: Optional[str] = None,
        details: Any = None,
        body: Any = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code
        self.details = details
        self.body = body

    def __repr__(self) -> str:
        return (
            f"ChronoShieldError(status={self.status}, code={self.code!r}, "
            f"message={self.message!r})"
        )


# ─── Client ──────────────────────────────────────────────────────────────────


class ChronoShieldClient:
    """Client for the ChronoShield API."""

    DEFAULT_BASE_URL = "https://chronoshieldapi.com"

    def __init__(self, api_key: str, base_url: Optional[str] = None) -> None:
        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key
        # Rate limit state from the most recent successful API call. None
        # until at least one call completes (and then only set when the
        # X-RateLimit-* response headers are present).
        self.last_rate_limit: Optional[RateLimitInfo] = None

    # ─── Datetime endpoints ──────────────────────────────────────────────────

    def validate(
        self, local_datetime: str, time_zone: str
    ) -> ValidateResponse:
        result = self._request(
            "POST",
            "/v1/datetime/validate",
            {"local_datetime": local_datetime, "time_zone": time_zone},
        )
        return ValidateResponse(**result)

    def resolve(
        self,
        local_datetime: str,
        time_zone: str,
        ambiguous: str = "earlier",
        invalid: str = "next_valid_time",
    ) -> ResolveResponse:
        result = self._request(
            "POST",
            "/v1/datetime/resolve",
            {
                "local_datetime": local_datetime,
                "time_zone": time_zone,
                "resolution_policy": {
                    "ambiguous": ambiguous,
                    "invalid": invalid,
                },
            },
        )
        return ResolveResponse(**result)

    def convert(
        self, instant_utc: str, target_time_zone: str
    ) -> ConvertResponse:
        result = self._request(
            "POST",
            "/v1/datetime/convert",
            {
                "instant_utc": instant_utc,
                "target_time_zone": target_time_zone,
            },
        )
        return ConvertResponse(**result)

    def batch(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        """Process up to 100 validate/resolve/convert operations in one request.

        Each item must include 'operation' ('validate', 'resolve', or 'convert')
        plus the relevant fields for that operation.

        Returns a dict with keys: 'results', 'total', 'succeeded', 'failed'.
        """
        return self._request("POST", "/v1/datetime/batch", {"items": items})

    def get_version(self) -> VersionResponse:
        """Return the IANA tzdata version currently powering the API.

        New in v1.1.0. Public endpoint — your API key is not required for
        this call (but is sent if configured).
        """
        result = self._request("GET", "/v1/datetime/version", body=None)
        return VersionResponse(**result)

    # ─── Internals ───────────────────────────────────────────────────────────

    def _request(
        self,
        method: str,
        endpoint: str,
        body: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            f"{self.base_url}{endpoint}",
            data=data,
            headers={
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
            },
            method=method,
        )

        try:
            with urllib.request.urlopen(req) as resp:
                self._update_rate_limit(resp.headers)
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            self._update_rate_limit(e.headers)
            raw = e.read().decode("utf-8")
            try:
                payload = json.loads(raw)
            except (ValueError, json.JSONDecodeError):
                payload = {"message": raw} if raw else {}
            raise ChronoShieldError(
                status=e.code,
                message=payload.get("message")
                or payload.get("error")
                or f"ChronoShield API error (HTTP {e.code})",
                code=payload.get("code"),
                details=payload.get("details"),
                body=payload,
            ) from None

    def _update_rate_limit(self, headers: Any) -> None:
        # urllib's headers object behaves like a Mapping[str, str] but is
        # case-insensitive. Be defensive: missing headers → leave state.
        try:
            limit = headers.get("X-RateLimit-Limit")
            remaining = headers.get("X-RateLimit-Remaining")
            reset = headers.get("X-RateLimit-Reset")
        except AttributeError:
            return
        if limit and remaining and reset:
            self.last_rate_limit = RateLimitInfo(
                limit=int(limit),
                remaining=int(remaining),
                reset_at=datetime.fromtimestamp(int(reset), tz=timezone.utc),
            )
