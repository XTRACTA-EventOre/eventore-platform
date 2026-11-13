CREATE TABLE IF NOT EXISTS event_inbox (
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  envelope JSON NOT NULL, outcome JSON,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id,client_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS event_outbox (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), published_at DATETIME(3),
  UNIQUE (tenant_id,client_event_id),
  FOREIGN KEY (tenant_id,client_event_id) REFERENCES event_inbox(tenant_id,client_event_id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
