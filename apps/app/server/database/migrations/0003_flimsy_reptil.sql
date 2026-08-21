-- Better Auth 1.7 identifies an account by (issuer, accountId) rather than by providerId alone.
--
-- Added nullable and backfilled before being made NOT NULL: `ADD COLUMN ... NOT NULL` without a
-- default fails outright on a table that already has rows, which is every instance upgrading.
--
-- 'local:credential' is the value Better Auth reserves for email/password accounts. This instance
-- configures no social provider, so every existing row is one — no other issuer can be present.
ALTER TABLE "accounts" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "accounts" SET "issuer" = 'local:credential' WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_account_id_idx" ON "accounts" USING btree ("issuer","account_id");
