CREATE TABLE IF NOT EXISTS app_user_roles (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role_name VARCHAR(32) NOT NULL CHECK (role_name IN ('Administrator','Supervisor','Operator','Transporter','Viewer')),
  PRIMARY KEY (user_id,role_name),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS tenant_access_guards (
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS access_audit (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  target_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  previous_roles JSON NOT NULL, assigned_roles JSON NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX access_audit_tenant (tenant_id,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
INSERT INTO app_user_roles(user_id,role_name)
SELECT id,'Operator' FROM app_users u WHERE NOT EXISTS
  (SELECT 1 FROM app_user_roles r WHERE r.user_id=u.id);
