-- CreateIndex
-- IF NOT EXISTS is defensive: if any manual hot-patching ever creates these
-- indexes outside the migration system (the way contact_inquiries got created
-- by self-healing $executeRawUnsafe), the migration can still finish cleanly.
CREATE INDEX IF NOT EXISTS "api_keys_stripe_customer_id_idx" ON "api_keys"("stripe_customer_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "request_logs_api_key_id_created_at_idx" ON "request_logs"("api_key_id", "created_at");
