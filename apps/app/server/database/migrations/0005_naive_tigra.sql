CREATE TYPE "public"."paste_format" AS ENUM('plain', 'markdown');--> statement-breakpoint
ALTER TABLE "pastes" ADD COLUMN "format" "paste_format" DEFAULT 'plain' NOT NULL;--> statement-breakpoint
ALTER TABLE "pastes" ADD CONSTRAINT "pastes_format_kind_check" CHECK ("pastes"."format" = 'plain' OR "pastes"."kind" = 'text');