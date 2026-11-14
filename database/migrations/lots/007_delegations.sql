CREATE TABLE IF NOT EXISTS lot_delegations (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sender_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  recipient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state VARCHAR(16) NOT NULL CHECK (state IN ('Proposed','Accepted','Revoked')),
  expires_at DATETIME(3) NOT NULL,
  INDEX lot_delegation_lookup (tenant_id,lot_id,state),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
