CREATE TABLE "banned_ips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"reason" text NOT NULL,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "banned_ips_ip_unique" UNIQUE("ip")
);
--> statement-breakpoint
CREATE TABLE "allowed_ips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"label" text,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_ips_ip_unique" UNIQUE("ip")
);
--> statement-breakpoint
ALTER TABLE "allowed_ips" ADD CONSTRAINT "allowed_ips_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;