FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
# agent-tools.json is the canonical AI-agent tool schema source. The build
# step copies it into dist/ so the runtime image (which only ships dist/)
# can serve it at /agent-tools.json. Must be copied into the builder before
# `npm run build` or the build fails with ENOENT.
COPY agent-tools.json ./
RUN npx prisma generate --schema=src/db/prisma/schema.prisma
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
# Keep prisma CLI available at runtime for `prisma migrate deploy`.
# `prisma` is listed under dependencies (not devDependencies) precisely
# so --omit=dev does not strip it.
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY src/db/prisma/schema.prisma ./src/db/prisma/schema.prisma
# Migrations directory MUST be copied into the runtime image — without it,
# `prisma migrate deploy` finds nothing to apply and the DB schema never
# gets created. (Previously only schema.prisma was copied, which is why
# production had no tables.)
COPY src/db/prisma/migrations/ ./src/db/prisma/migrations/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Fail loudly if migrations cannot be applied — a silent `2>/dev/null` + `;`
# fallthrough is what hid this bug for weeks. If the DB can't be migrated,
# the server should NOT boot in a broken state.
CMD npx prisma migrate deploy --schema=src/db/prisma/schema.prisma && node dist/server.js
