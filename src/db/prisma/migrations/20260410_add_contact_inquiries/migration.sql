-- CreateTable
-- IF NOT EXISTS guards against the case where the contact route's
-- self-healing $executeRawUnsafe created this table before Prisma's
-- migration system caught up. Safe on fresh DBs (behaves identically
-- to CREATE TABLE) and idempotent on partial-state DBs.
CREATE TABLE IF NOT EXISTS "contact_inquiries" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_inquiries_pkey" PRIMARY KEY ("id")
);
