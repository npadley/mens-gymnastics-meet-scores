CREATE TYPE "public"."competition_level" AS ENUM('elite', 'junior_elite', 'level_10', 'level_9', 'level_8', 'level_7', 'level_6', 'ncaa', 'gymact', 'naigc', 'development');--> statement-breakpoint
CREATE TYPE "public"."duplicate_status" AS ENUM('pending', 'merged', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."program_type" AS ENUM('club', 'ncaa', 'national_team', 'club_adult');--> statement-breakpoint
CREATE TYPE "public"."scrape_status" AS ENUM('success', 'error', 'skipped', 'partial');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('gymternet', 'usag_pdf', 'road_to_nationals', 'meetscoresonline', 'winter_cup', 'manual');--> statement-breakpoint
CREATE TABLE "gymnast_name_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"gymnast_id" text NOT NULL,
	"raw_name" text NOT NULL,
	"source" "source" NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gymnast_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"gymnast_id" text NOT NULL,
	"program_id" text NOT NULL,
	"season" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gymnasts" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"birth_year" integer,
	"state" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"merged_into_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" "competition_level" NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"location" text,
	"season" integer NOT NULL,
	"source" "source" NOT NULL,
	"source_url" text,
	"source_id" text,
	"is_complete" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_duplicates" (
	"id" text PRIMARY KEY NOT NULL,
	"gymnast_a_id" text NOT NULL,
	"gymnast_b_id" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"match_reason" text,
	"status" "duplicate_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "program_type" NOT NULL,
	"state" text,
	"ncaa_conference" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" text PRIMARY KEY NOT NULL,
	"meet_id" text NOT NULL,
	"gymnast_id" text NOT NULL,
	"program_id" text,
	"apparatus" text NOT NULL,
	"d_score" numeric(5, 3),
	"e_score" numeric(5, 3),
	"penalty" numeric(4, 3) DEFAULT '0',
	"final_score" numeric(6, 3) NOT NULL,
	"place" integer,
	"is_qualified" boolean,
	"round" text DEFAULT 'finals' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "source" NOT NULL,
	"target_url" text,
	"target_id" text,
	"status" "scrape_status" NOT NULL,
	"records_found" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "gymnast_name_variants" ADD CONSTRAINT "gymnast_name_variants_gymnast_id_gymnasts_id_fk" FOREIGN KEY ("gymnast_id") REFERENCES "public"."gymnasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gymnast_programs" ADD CONSTRAINT "gymnast_programs_gymnast_id_gymnasts_id_fk" FOREIGN KEY ("gymnast_id") REFERENCES "public"."gymnasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gymnast_programs" ADD CONSTRAINT "gymnast_programs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_duplicates" ADD CONSTRAINT "pending_duplicates_gymnast_a_id_gymnasts_id_fk" FOREIGN KEY ("gymnast_a_id") REFERENCES "public"."gymnasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_duplicates" ADD CONSTRAINT "pending_duplicates_gymnast_b_id_gymnasts_id_fk" FOREIGN KEY ("gymnast_b_id") REFERENCES "public"."gymnasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_meet_id_meets_id_fk" FOREIGN KEY ("meet_id") REFERENCES "public"."meets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_gymnast_id_gymnasts_id_fk" FOREIGN KEY ("gymnast_id") REFERENCES "public"."gymnasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gymnast_name_variants_raw_source_idx" ON "gymnast_name_variants" USING btree ("raw_name","source");--> statement-breakpoint
CREATE INDEX "gymnast_name_variants_gymnast_idx" ON "gymnast_name_variants" USING btree ("gymnast_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gymnast_programs_unique_idx" ON "gymnast_programs" USING btree ("gymnast_id","program_id","season");--> statement-breakpoint
CREATE INDEX "gymnast_programs_gymnast_idx" ON "gymnast_programs" USING btree ("gymnast_id");--> statement-breakpoint
CREATE INDEX "gymnasts_normalized_name_idx" ON "gymnasts" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "gymnasts_merged_into_idx" ON "gymnasts" USING btree ("merged_into_id");--> statement-breakpoint
CREATE INDEX "meets_season_level_idx" ON "meets" USING btree ("season","level");--> statement-breakpoint
CREATE INDEX "meets_start_date_idx" ON "meets" USING btree ("start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "meets_source_unique_idx" ON "meets" USING btree ("source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_dupes_pair_idx" ON "pending_duplicates" USING btree ("gymnast_a_id","gymnast_b_id");--> statement-breakpoint
CREATE INDEX "pending_dupes_status_idx" ON "pending_duplicates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_dupes_confidence_idx" ON "pending_duplicates" USING btree ("confidence");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_name_type_idx" ON "programs" USING btree ("name","type");--> statement-breakpoint
CREATE INDEX "results_gymnast_apparatus_idx" ON "results" USING btree ("gymnast_id","apparatus");--> statement-breakpoint
CREATE INDEX "results_meet_idx" ON "results" USING btree ("meet_id");--> statement-breakpoint
CREATE INDEX "results_gymnast_meet_idx" ON "results" USING btree ("gymnast_id","meet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "results_unique_idx" ON "results" USING btree ("meet_id","gymnast_id","apparatus","round");--> statement-breakpoint
CREATE INDEX "scrape_logs_source_status_idx" ON "scrape_logs" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "scrape_logs_started_at_idx" ON "scrape_logs" USING btree ("started_at");