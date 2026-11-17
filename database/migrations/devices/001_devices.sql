CREATE TABLE IF NOT EXISTS device_operations (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 command JSON NOT NULL, result JSON, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,operation_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS devices (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 serial VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE, name VARCHAR(200) NOT NULL,
 operation_lot_id CHAR(36) NOT NULL, version INT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, disabled_reason VARCHAR(1000),
 credential_hash CHAR(64), last_communication DATETIME(3), battery INT, battery_reported_at DATETIME(3),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX device_tenant(tenant_id,id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS device_calibrations (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 device_id CHAR(36) NOT NULL, calibrated_at DATETIME(3) NOT NULL, expires_at DATETIME(3) NOT NULL, evidence_ref VARCHAR(1000) NOT NULL,
 actor_id CHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX calibration_device(tenant_id,device_id,calibrated_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS device_readings (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, device_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, payload JSON NOT NULL, result JSON NOT NULL,
 received_at DATETIME(3) NOT NULL, PRIMARY KEY(tenant_id,device_id,event_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS device_alerts (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 device_id CHAR(36) NOT NULL, kind VARCHAR(30) NOT NULL, details JSON NOT NULL, opened_at DATETIME(3) NOT NULL, resolved_at DATETIME(3), INDEX device_alert_tenant(tenant_id,device_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS device_audit (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 device_id CHAR(36) NOT NULL, actor_id CHAR(36), action VARCHAR(40) NOT NULL, payload JSON NOT NULL, occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX device_audit_tenant(tenant_id,device_id)
) ENGINE=InnoDB;
