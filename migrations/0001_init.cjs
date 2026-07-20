/* Walking skeleton schema — spec-0001 */
exports.up = (pgm) => {
  pgm.sql("CREATE EXTENSION IF NOT EXISTS vector");

  pgm.sql(`
    CREATE TABLE events (
      id bigserial PRIMARY KEY,
      type text NOT NULL,
      version int NOT NULL,
      occurred_at timestamptz NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now(),
      payload jsonb NOT NULL
    )
  `);
  pgm.sql(`
    CREATE FUNCTION forbid_event_mutation() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'events table is append-only';
    END;
    $$ LANGUAGE plpgsql
  `);
  pgm.sql(`
    CREATE TRIGGER events_append_only
    BEFORE UPDATE OR DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION forbid_event_mutation()
  `);

  pgm.sql(`
    CREATE TABLE consumer_cursors (
      consumer text PRIMARY KEY,
      last_event_id bigint NOT NULL DEFAULT 0
    )
  `);

  pgm.sql(`
    CREATE TABLE entities (
      id uuid PRIMARY KEY,
      kind text NOT NULL,
      canonical_name text NOT NULL
    )
  `);
  pgm.sql(`
    CREATE TABLE entity_aliases (
      entity_id uuid NOT NULL REFERENCES entities(id),
      alias text NOT NULL,
      PRIMARY KEY (entity_id, alias)
    )
  `);
  pgm.sql(`
    CREATE TABLE edges (
      from_id uuid NOT NULL,
      to_id uuid NOT NULL,
      type text NOT NULL,
      valid_from timestamptz NOT NULL,
      valid_to timestamptz,
      recorded_at timestamptz NOT NULL,
      PRIMARY KEY (from_id, to_id, type, valid_from)
    )
  `);

  pgm.sql(`
    CREATE TABLE episodes (
      id text PRIMARY KEY,
      summary text NOT NULL,
      entity_ids uuid[] NOT NULL DEFAULT '{}',
      valid_from timestamptz NOT NULL,
      valid_to timestamptz,
      recorded_at timestamptz NOT NULL,
      embedding vector NULL
    )
  `);

  pgm.sql(`
    CREATE TABLE goals_current (
      id text PRIMARY KEY,
      title text NOT NULL,
      status text NOT NULL,
      revision int NOT NULL
    )
  `);

  pgm.sql(`
    CREATE TABLE situation_items (
      id text PRIMARY KEY,
      kind text NOT NULL,
      horizon text NOT NULL,
      status text NOT NULL,
      entity_ids uuid[] NOT NULL DEFAULT '{}',
      source_event_id bigint NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}',
      updated_at timestamptz NOT NULL
    )
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE situation_items");
  pgm.sql("DROP TABLE goals_current");
  pgm.sql("DROP TABLE episodes");
  pgm.sql("DROP TABLE edges");
  pgm.sql("DROP TABLE entity_aliases");
  pgm.sql("DROP TABLE entities");
  pgm.sql("DROP TABLE consumer_cursors");
  pgm.sql("DROP TRIGGER events_append_only ON events");
  pgm.sql("DROP FUNCTION forbid_event_mutation");
  pgm.sql("DROP TABLE events");
};
