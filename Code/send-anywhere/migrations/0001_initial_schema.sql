-- 転送セッション
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  key6 TEXT NOT NULL,
  upload_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading', -- uploading | ready
  file_count INTEGER NOT NULL DEFAULT 0,
  total_size INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  key_expires_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 転送に含まれるファイル
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  r2_key TEXT NOT NULL,
  uploaded INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (transfer_id) REFERENCES transfers(id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_key6 ON transfers(key6);
CREATE INDEX IF NOT EXISTS idx_transfers_expires ON transfers(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_transfer ON files(transfer_id);
