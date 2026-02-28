CREATE TABLE IF NOT EXISTS replay_lineage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_trace_id TEXT NOT NULL,
  child_trace_id TEXT NOT NULL UNIQUE,
  source_dead_letter_id INTEGER,
  retry_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_retry_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_lineage_parent ON replay_lineage(parent_trace_id);
CREATE INDEX IF NOT EXISTS idx_replay_lineage_created ON replay_lineage(created_at);
