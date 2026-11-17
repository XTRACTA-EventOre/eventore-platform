CREATE TABLE IF NOT EXISTS custody_operations (
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state VARCHAR(16) NOT NULL CHECK (state IN ('Pending','Accepted','Rejected')),
  command JSON NOT NULL, result JSON,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id,operation_id),
  INDEX custody_lot_lookup (tenant_id,lot_id,state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
