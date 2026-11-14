CREATE TABLE IF NOT EXISTS jewelry_operations (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id CHAR(36) NOT NULL, action VARCHAR(40) NOT NULL, state VARCHAR(16) NOT NULL, command JSON NOT NULL, result JSON,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,operation_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS inventory_materials (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 lot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin, mineral_type VARCHAR(80) NOT NULL, category VARCHAR(20) NOT NULL,
 source VARCHAR(1000) NOT NULL, quantity_grams VARCHAR(100) NOT NULL, available_grams VARCHAR(100) NOT NULL,
 source_version INT, version INT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(tenant_id,id), UNIQUE KEY inventory_lot(tenant_id,lot_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS jewelry_products (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 name VARCHAR(200) NOT NULL, version INT NOT NULL, composition JSON NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS composition_history (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, product_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 version INT NOT NULL, operation_id CHAR(36) NOT NULL, actor_id CHAR(36) NOT NULL, reason VARCHAR(1000) NOT NULL,
 before_composition JSON NOT NULL, after_composition JSON NOT NULL, occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,product_id,version)
) ENGINE=InnoDB;
