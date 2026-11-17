-- 分割(マルチパート)アップロードのパート管理
CREATE TABLE IF NOT EXISTS parts (
  file_id TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  etag TEXT NOT NULL,
  PRIMARY KEY (file_id, part_number)
);
