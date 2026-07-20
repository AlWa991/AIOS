/* Perception-owned ingest state for idempotent re-runs — spec-0002 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE perception_watermarks (
      source text NOT NULL,
      item_uid text NOT NULL,
      content_hash text NOT NULL,
      last_seen_at timestamptz NOT NULL,
      PRIMARY KEY (source, item_uid)
    )
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE perception_watermarks");
};
