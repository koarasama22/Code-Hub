-- 分割(マルチパート)アップロード用の列を追加
ALTER TABLE files ADD COLUMN upload_id TEXT;
ALTER TABLE files ADD COLUMN part_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN uploaded_bytes INTEGER NOT NULL DEFAULT 0;
