import {
  pgTable,
  pgEnum,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const competitionLevelEnum = pgEnum("competition_level", [
  "elite",
  "junior_elite",
  "level_10",
  "level_9",
  "level_8",
  "level_7",
  "level_6",
  "ncaa",
  "gymact",
  "naigc",
  "development",
]);

export const sourceEnum = pgEnum("source", [
  "gymternet",
  "usag_pdf",
  "road_to_nationals",
  "meetscoresonline",
  "winter_cup",
  "manual",
]);

export const programTypeEnum = pgEnum("program_type", [
  "club",
  "ncaa",
  "national_team",
  "club_adult",
]);

export const scrapeStatusEnum = pgEnum("scrape_status", [
  "success",
  "error",
  "skipped",
  "partial",
]);

export const duplicateStatusEnum = pgEnum("duplicate_status", [
  "pending",
  "merged",
  "rejected",
]);

// ─── Gymnasts ─────────────────────────────────────────────────────────────────

export const gymnasts = pgTable(
  "gymnasts",
  {
    id: text("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    // Normalized: lowercase, no punctuation, diacritics stripped — used for fuzzy matching
    normalizedName: text("normalized_name").notNull(),
    birthYear: integer("birth_year"),
    state: text("state"), // 2-letter US state abbreviation
    isVerified: boolean("is_verified").default(false).notNull(),
    // Soft-delete: set when this record was merged into another
    mergedIntoId: text("merged_into_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("gymnasts_normalized_name_idx").on(t.normalizedName),
    index("gymnasts_merged_into_idx").on(t.mergedIntoId),
  ]
);

// Every raw name spelling observed for a gymnast across all sources
export const gymnastNameVariants = pgTable(
  "gymnast_name_variants",
  {
    id: text("id").primaryKey(),
    gymnastId: text("gymnast_id")
      .notNull()
      .references(() => gymnasts.id),
    rawName: text("raw_name").notNull(),
    source: sourceEnum("source").notNull(),
    firstSeen: timestamp("first_seen").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("gymnast_name_variants_raw_source_idx").on(
      t.rawName,
      t.source
    ),
    index("gymnast_name_variants_gymnast_idx").on(t.gymnastId),
  ]
);

// ─── Programs ─────────────────────────────────────────────────────────────────

export const programs = pgTable(
  "programs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: programTypeEnum("type").notNull(),
    state: text("state"),
    ncaaConference: text("ncaa_conference"), // "MPSF", "EAGL", "MRGC", etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("programs_name_type_idx").on(t.name, t.type)]
);

// Time-bounded: a gymnast may compete for different programs across seasons
export const gymnastPrograms = pgTable(
  "gymnast_programs",
  {
    id: text("id").primaryKey(),
    gymnastId: text("gymnast_id")
      .notNull()
      .references(() => gymnasts.id),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id),
    season: integer("season").notNull(), // e.g. 2024 (spring NCAA = the year it ends)
  },
  (t) => [
    uniqueIndex("gymnast_programs_unique_idx").on(
      t.gymnastId,
      t.programId,
      t.season
    ),
    index("gymnast_programs_gymnast_idx").on(t.gymnastId),
  ]
);

// ─── Meets ────────────────────────────────────────────────────────────────────

export const meets = pgTable(
  "meets",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    level: competitionLevelEnum("level").notNull(),
    startDate: timestamp("start_date", { mode: "date" }).notNull(),
    endDate: timestamp("end_date", { mode: "date" }),
    location: text("location"), // "City, ST"
    season: integer("season").notNull(), // competition season year
    source: sourceEnum("source").notNull(),
    sourceUrl: text("source_url"),
    // Platform-specific ID for idempotency checks (e.g. MSO "R12345", RTN meet ID)
    sourceId: text("source_id"),
    isComplete: boolean("is_complete").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("meets_season_level_idx").on(t.season, t.level),
    index("meets_start_date_idx").on(t.startDate),
    uniqueIndex("meets_source_unique_idx").on(t.source, t.sourceId),
  ]
);

// ─── Results ─────────────────────────────────────────────────────────────────

// One row per gymnast per apparatus per meet per round.
// apparatus = null means AA aggregate row; populated = individual event.
export const results = pgTable(
  "results",
  {
    id: text("id").primaryKey(),
    meetId: text("meet_id")
      .notNull()
      .references(() => meets.id),
    gymnastId: text("gymnast_id")
      .notNull()
      .references(() => gymnasts.id),
    programId: text("program_id").references(() => programs.id),

    // 'FX'|'PH'|'SR'|'VT'|'PB'|'HB' for individual events, 'AA' for all-around
    apparatus: text("apparatus").notNull(),

    // Score breakdown (D+E format for optional levels; compulsory = eScore only)
    dScore: numeric("d_score", { precision: 5, scale: 3 }),
    eScore: numeric("e_score", { precision: 5, scale: 3 }),
    penalty: numeric("penalty", { precision: 4, scale: 3 }).default("0"),
    finalScore: numeric("final_score", { precision: 6, scale: 3 }).notNull(),

    place: integer("place"),
    isQualified: boolean("is_qualified"), // NCAA qualifying score, national team qualifier, etc.

    // 'prelims'|'finals'|'aa' — allows tracking both rounds when applicable
    round: text("round").default("finals").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("results_gymnast_apparatus_idx").on(t.gymnastId, t.apparatus),
    index("results_meet_idx").on(t.meetId),
    index("results_gymnast_meet_idx").on(t.gymnastId, t.meetId),
    uniqueIndex("results_unique_idx").on(
      t.meetId,
      t.gymnastId,
      t.apparatus,
      t.round
    ),
  ]
);

// ─── Scrape Logs ──────────────────────────────────────────────────────────────

export const scrapeLogs = pgTable(
  "scrape_logs",
  {
    id: text("id").primaryKey(),
    source: sourceEnum("source").notNull(),
    targetUrl: text("target_url"),
    targetId: text("target_id"), // e.g. MSO meet ID, PDF filename
    status: scrapeStatusEnum("status").notNull(),
    recordsFound: integer("records_found").default(0),
    recordsInserted: integer("records_inserted").default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("scrape_logs_source_status_idx").on(t.source, t.status),
    index("scrape_logs_started_at_idx").on(t.startedAt),
  ]
);

// ─── Pending Duplicates ───────────────────────────────────────────────────────

// Admin review queue for gymnast identity conflicts
export const pendingDuplicates = pgTable(
  "pending_duplicates",
  {
    id: text("id").primaryKey(),
    gymnastAId: text("gymnast_a_id")
      .notNull()
      .references(() => gymnasts.id),
    gymnastBId: text("gymnast_b_id")
      .notNull()
      .references(() => gymnasts.id),
    // Composite confidence score 0.0-1.0 from fuzzy match signals
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    // Human-readable signal breakdown, e.g. "lev:0.92,same_program:true"
    matchReason: text("match_reason"),
    status: duplicateStatusEnum("status").default("pending").notNull(),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("pending_dupes_pair_idx").on(t.gymnastAId, t.gymnastBId),
    index("pending_dupes_status_idx").on(t.status),
    index("pending_dupes_confidence_idx").on(t.confidence),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const gymnastsRelations = relations(gymnasts, ({ many }) => ({
  nameVariants: many(gymnastNameVariants),
  programs: many(gymnastPrograms),
  results: many(results),
  duplicatesA: many(pendingDuplicates, { relationName: "gymnast_a" }),
  duplicatesB: many(pendingDuplicates, { relationName: "gymnast_b" }),
}));

export const gymnastNameVariantsRelations = relations(
  gymnastNameVariants,
  ({ one }) => ({
    gymnast: one(gymnasts, {
      fields: [gymnastNameVariants.gymnastId],
      references: [gymnasts.id],
    }),
  })
);

export const programsRelations = relations(programs, ({ many }) => ({
  gymnasts: many(gymnastPrograms),
  results: many(results),
}));

export const gymnastProgramsRelations = relations(
  gymnastPrograms,
  ({ one }) => ({
    gymnast: one(gymnasts, {
      fields: [gymnastPrograms.gymnastId],
      references: [gymnasts.id],
    }),
    program: one(programs, {
      fields: [gymnastPrograms.programId],
      references: [programs.id],
    }),
  })
);

export const meetsRelations = relations(meets, ({ many }) => ({
  results: many(results),
}));

export const resultsRelations = relations(results, ({ one }) => ({
  meet: one(meets, {
    fields: [results.meetId],
    references: [meets.id],
  }),
  gymnast: one(gymnasts, {
    fields: [results.gymnastId],
    references: [gymnasts.id],
  }),
  program: one(programs, {
    fields: [results.programId],
    references: [programs.id],
  }),
}));

export const pendingDuplicatesRelations = relations(
  pendingDuplicates,
  ({ one }) => ({
    gymnastA: one(gymnasts, {
      fields: [pendingDuplicates.gymnastAId],
      references: [gymnasts.id],
      relationName: "gymnast_a",
    }),
    gymnastB: one(gymnasts, {
      fields: [pendingDuplicates.gymnastBId],
      references: [gymnasts.id],
      relationName: "gymnast_b",
    }),
  })
);
