ALTER TABLE runs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE dead_letters ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_runs_workspace_started ON runs(workspace_id, started_at);
CREATE INDEX IF NOT EXISTS idx_dead_letters_workspace_created ON dead_letters(workspace_id, created_at);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  scopes_json TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(provider, account_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_workspace ON oauth_tokens(workspace_id, provider, updated_at);
