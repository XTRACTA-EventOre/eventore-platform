CREATE TABLE IF NOT EXISTS mineral_lots (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mineral_type VARCHAR(32) NOT NULL,
  weight DECIMAL(65,30) NOT NULL CHECK (weight > 0),
  weight_unit VARCHAR(2) NOT NULL CHECK (weight_unit IN ('g','kg','t')),
  status VARCHAR(16) NOT NULL CHECK (status IN ('Registered','Cancelled')),
  version INT NOT NULL CHECK (version > 0), created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS origin_evidence (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  reference TEXT NOT NULL, source TEXT NOT NULL,
  review_status VARCHAR(16) NOT NULL DEFAULT 'PendingReview'
    CHECK (review_status IN ('PendingReview','Verified','Rejected')),
  UNIQUE (tenant_id,lot_id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS trace_events (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_id TEXT NOT NULL, event_type VARCHAR(64) NOT NULL,
  occurred_at DATETIME(6) NOT NULL, payload JSON NOT NULL,
  UNIQUE (tenant_id,client_event_id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
