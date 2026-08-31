CREATE TYPE "public"."legal_document_slug" AS ENUM('privacy', 'terms', 'notice');--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"slug" "legal_document_slug" NOT NULL,
	"locale" text NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "legal_documents_slug_locale_pk" PRIMARY KEY("slug","locale")
);
--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;