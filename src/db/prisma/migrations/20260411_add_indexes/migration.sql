-- CreateIndex
CREATE INDEX "api_keys_stripe_customer_id_idx" ON "api_keys"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "request_logs_api_key_id_created_at_idx" ON "request_logs"("api_key_id", "created_at");
