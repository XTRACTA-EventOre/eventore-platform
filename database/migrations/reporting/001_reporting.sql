CREATE TABLE IF NOT EXISTS reporting_operations (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 command JSON NOT NULL, result JSON, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,operation_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS reporting_snapshots (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 kind VARCHAR(30) NOT NULL, parameters JSON NOT NULL, result JSON NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX report_snapshot_tenant(tenant_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS evidence_exports (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id CHAR(36) NOT NULL, parameters JSON NOT NULL, state VARCHAR(16) NOT NULL, content LONGBLOB, source_captured_at DATETIME(3),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), completed_at DATETIME(3), PRIMARY KEY(tenant_id,id)
) ENGINE=InnoDB;
