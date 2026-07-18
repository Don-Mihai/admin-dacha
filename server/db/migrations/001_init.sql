CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login VARCHAR(64) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  hall_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_documents (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_key VARCHAR(128) NOT NULL,
  file_name VARCHAR(256) NOT NULL,
  schema_hint VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, document_key)
);

CREATE TABLE IF NOT EXISTS content_revisions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES content_documents(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_revisions_document
  ON content_revisions(document_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS media_assets (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  mime VARCHAR(128),
  size BIGINT,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  entity VARCHAR(128),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
