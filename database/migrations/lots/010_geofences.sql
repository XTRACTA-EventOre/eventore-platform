CREATE TABLE IF NOT EXISTS geofence_operations (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 command JSON NOT NULL, result JSON, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,operation_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS authorized_concessions (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 name VARCHAR(200) NOT NULL, polygon JSON NOT NULL, source VARCHAR(1000) NOT NULL, authorization_ref VARCHAR(1000) NOT NULL,
 approved_by CHAR(36) NOT NULL, approved_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lot_location_checks (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, result JSON NOT NULL,
 occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,lot_id,operation_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lot_capture_locations (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 declaration JSON NOT NULL, PRIMARY KEY(tenant_id,lot_id)
) ENGINE=InnoDB;
