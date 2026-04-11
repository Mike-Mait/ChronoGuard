# Changelog

All notable changes to ChronoShield API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.0] - 2026-04-11

### Added
- **Automated Stripe lifecycle** — API keys now automatically downgrade to free tier on `charge.refunded`, `invoice.payment_failed`, and `customer.subscription.deleted` webhook events
- **Enterprise contact form** — replaced `mailto:` Contact Sales buttons with an inline modal form (`POST /api/contact`) backed by `contact_inquiries` database table with self-healing schema creation
- **Email notifications** — contact form submissions now trigger email notifications to `sales@chronoshieldapi.com` via Resend SMTP (nodemailer)
- **Request logging** — authenticated API requests are now persisted to the `request_logs` table (endpoint, method, status, latency, key ID) for usage analytics
- **Admin endpoints** — `POST /api/admin/keys/revoke`, `POST /api/admin/keys/activate`, `GET /api/admin/keys` for key management, protected by master API key
- **Lazy monthly usage reset** — `requestsUsed` automatically resets to 0 on the first request of a new month via `resetAt` field (no cron required)
- **Per-IP rate limiting** on `/api/keys` — 10 requests per minute to prevent key generation abuse
- **Security headers** — `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- **Rate limit response headers** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` exposed on every authenticated response
- **Static HTML caching** — landing, docs, terms, privacy, and AUP pages cached in memory at startup
- **Professional contact addresses** — `info@`, `support@`, `sales@`, `security@chronoshieldapi.com` integrated across docs and landing page
- **SDK polish** — TypeScript and Python SDKs now include READMEs, complete metadata, version exports, and are publish-ready for npm/PyPI

### Changed
- **API key preservation** — keys are no longer regenerated on server restart; existing DB records are preserved
- **Stripe client** — refactored to a singleton via `getStripe()` to prevent repeated instantiation
- **Memory cache eviction** — in-memory key store now caps at 10,000 entries with FIFO eviction
- **Webhook error sanitization** — invalid signature errors no longer leak internal details
- **Email validation** — stricter regex and 254-character limit on `/api/keys` and `/api/contact`
- **Trust proxy** — Fastify configured with `trustProxy: true` for accurate client IPs behind Railway's reverse proxy
- **Status endpoint** — removed `icu_version` and `node_version` from `timezone_data` response

### Fixed
- **Key invalidation on restart** — fixed bug where regenerating keys on server restart would invalidate users' saved keys
- **Rate limiting on Railway** — `request.ip` now resolves correctly behind the reverse proxy
- **Double subscription guard** — `/api/keys` now blocks creating a second Stripe checkout for users already on Pro
- **API key removed from URLs** — Stripe `success_url` no longer includes the raw key as a query parameter

### Security
- Removed accidentally committed `.claude/settings.local.json` containing Railway API tokens; scrubbed from git history
- Added `.claude/settings.local.json` to `.gitignore`

## [1.2.0] - 2026-04-07

### Added
- **CORS support** — configured `@fastify/cors` with allowed origins, methods, and headers for browser-based API integrations
- **Cookie consent banner** — dismissible, non-tracking banner on all pages with localStorage persistence
- **Acceptable Use Policy** — standalone `/aup` page covering prohibited uses, rate limit abuse, and enforcement
- **Security disclosure** — `/.well-known/security.txt` endpoint (IETF RFC 9116) for vulnerability reporting
- **Billing, Cancellation & Refunds** — new section 7 in Terms of Service documenting Pro tier cancellation and 7-day refund policy
- **Public status page** — uptime monitoring and incident history at [chronoshield-api.betteruptime.com](https://chronoshield-api.betteruptime.com)
- **Request payload limits** — 1 MB body limit on Fastify, max string length constraints on all Zod schemas

### Changed
- **Error responses standardized** — all errors now return consistent `{ error, code, message }` schema with machine-readable codes (e.g., `UNAUTHORIZED`, `VALIDATION_FAILED`, `RATE_LIMIT_EXCEEDED`)
- **CORS preflight** — OPTIONS requests bypass auth to allow browser preflight to succeed
- **Privacy Policy** — replaced "working toward GDPR" with concrete lawful basis (Article 6(1)(b)) and DPA availability
- **Status links** — all navigation links now point to Better Stack public status page
- **SDK install commands** — labeled as "coming soon" until packages are published to npm/PyPI
- **Build pipeline** — Prisma generate and migrate deploy now run automatically during build and start

### Fixed
- **CORS preflight 401** — auth hook was blocking OPTIONS requests before `@fastify/cors` could respond
- **Prisma schema path** — build script now uses `--schema=src/db/prisma/schema.prisma` to match non-default location

## [1.1.0] - 2026-03-30

### Added
- **Batch endpoint** (`POST /v1/datetime/batch`) — process up to 100 validate/resolve/convert operations in a single request
- **Persistent key storage** — API keys are now stored in PostgreSQL via Prisma, surviving server restarts
- **Rate limiting enforcement** — per-key usage tracking with `429 Too Many Requests` responses and tier-aware messaging
- **API versioning headers** — all responses include `X-API-Version: 1.0.0`
- **Adversarial test suite** — 19 new edge-case tests covering Lord Howe Island (30-min DST), Chatham Islands (UTC+12:45), Nepal (UTC+5:45), Iran (UTC+3:30), Samoa (UTC+13), date-line crossings, and DST boundary conditions
- **SDK default base URL** — TypeScript and Python SDKs default to the production API; only an API key is needed
- **Python SDK packaging** — added `pyproject.toml` for pip publishability

### Changed
- Auth hook now validates dynamically generated API keys (from the landing page) against both database and in-memory stores
- Swagger UI moved from `/docs` to `/docs/playground`; custom docs page now served at `/docs`
- OpenAPI spec now lists both production and local development servers
- All public-facing URLs aligned to use the canonical `chronoshieldapi.com` domain

### Fixed
- **Critical auth bug** — API keys generated via the landing page were not being validated; requests with generated keys returned 401
- **URL inconsistency** — landing page code examples showed `api.chronoguard.dev` while the actual domain was different
- **Graceful shutdown** — server now properly disconnects from PostgreSQL on SIGINT/SIGTERM

## [1.0.0] - 2026-03-29

### Added
- Core API: `/v1/datetime/validate`, `/v1/datetime/resolve`, `/v1/datetime/convert`
- DST gap detection (spring-forward) with `next_valid_time` and `previous_valid_time` suggestions
- DST overlap detection (fall-back) with `earlier`, `later`, `reject` resolution policies
- Zod request validation with structured error responses
- Landing page with Tailwind CSS, pricing tiers, email-based API key generation
- Stripe Checkout integration for Pro tier ($19/month, 100K requests)
- TypeScript and Python SDKs
- AI agent tool schemas (`agent-tools.json`)
- OpenAPI 3.1 specification
- Docker Compose setup (API + PostgreSQL + Redis)
- 31 unit and integration tests
