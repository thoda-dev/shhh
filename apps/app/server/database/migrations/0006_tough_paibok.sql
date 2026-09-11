-- Better Auth 1.7.3 identifies an account by (providerId, accountId) again, as 1.6 did, and never writes `issuer`.
-- It also checks the Drizzle schema at boot and refuses a NOT NULL column it never fills, so this is what makes sign-up work at all.
--
-- The column stays, nullable: 1.7.2 still writes it, so a database migrated this far keeps working under v1.2.0 if an operator rolls back.
DROP INDEX "accounts_issuer_account_id_idx";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" DROP NOT NULL;