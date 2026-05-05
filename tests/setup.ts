/**
 * Vitest setup file — runs before each test file is evaluated.
 *
 * Forces tests onto the in-memory fallback paths in `src/db/client.ts` and
 * `src/routes/keys.ts`. Without this, the dev `.env` (loaded by `dotenv` at
 * the top of `src/config/env.ts`) populates `DATABASE_URL` with a localhost
 * Postgres URL — which isn't running during a pure-Node test session, so
 * Prisma throws `Can't reach database server at localhost:5432` on first
 * query.
 *
 * `dotenv.config()` only writes a key if it isn't already defined in
 * `process.env`. By setting an empty string here BEFORE the test file's
 * imports trigger `config/env.ts`, dotenv leaves it alone and
 * `config.databaseUrl` resolves to "", which makes `getPrisma()` return
 * null — exercising the in-memory fallback paths instead.
 *
 * If a future test genuinely needs Postgres, override at the test level
 * with `vi.stubEnv("DATABASE_URL", "...")` rather than removing this.
 */
process.env.DATABASE_URL = "";
