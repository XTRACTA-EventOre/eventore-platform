CREATE TABLE IF NOT EXISTS lot_handovers (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  recipient_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
  prepared_by VARCHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL CHECK (state IN ('Available','Consumed','Revoked')),
  expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX lot_handovers_lookup (tenant_id,lot_id,state),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS lot_restrictions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  reason VARCHAR(1000) NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
  INDEX lot_restrictions_lookup (tenant_id,lot_id,active),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS lot_lifecycle_events (
  operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id VARCHAR(64) NOT NULL, action VARCHAR(32) NOT NULL,
  command JSON NOT NULL, result JSON NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id,operation_id),
  INDEX lot_lifecycle_lookup (tenant_id,lot_id,occurred_at),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
