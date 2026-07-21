/* spec-0004: triage, seen-state, priorities and overrides projections */
exports.up = (pgm) => {
  // Latest triage per day
  pgm.sql(`
    CREATE TABLE triage_current (
      day text PRIMARY KEY,
      triage_id text NOT NULL,
      payload jsonb NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Per-item seen-state: when was each item last presented
  pgm.sql(`
    CREATE TABLE item_seen (
      item_id text NOT NULL,
      day text NOT NULL,
      presented_at timestamptz NOT NULL,
      PRIMARY KEY (item_id, day)
    )
  `);

  // Stated priorities (for provenance checks)
  pgm.sql(`
    CREATE TABLE priorities (
      priority_id text PRIMARY KEY,
      text text NOT NULL,
      scope text NOT NULL,
      source_event_id text NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Overrides (promote / ignore / ignore_permanent / disagree_overruled)
  pgm.sql(`
    CREATE TABLE overrides (
      item_id text NOT NULL,
      kind text NOT NULL,
      source_event_id text NOT NULL,
      day text NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (item_id, day, kind)
    )
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE overrides");
  pgm.sql("DROP TABLE priorities");
  pgm.sql("DROP TABLE item_seen");
  pgm.sql("DROP TABLE triage_current");
};
