CREATE TABLE IF NOT EXISTS trip_routes (
 tenant_id CHAR(36) NOT NULL, lot_id CHAR(36) NOT NULL, corridor JSON NOT NULL,
 started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), deadline DATETIME(3) NOT NULL,
 received_at DATETIME(3), delayed_at DATETIME(3), PRIMARY KEY(tenant_id,lot_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS trip_positions (
 tenant_id CHAR(36) NOT NULL, lot_id CHAR(36) NOT NULL, id CHAR(36) NOT NULL, actor_id CHAR(36) NOT NULL,
 latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL, occurred_at DATETIME(3) NOT NULL,
 distance_km DOUBLE NOT NULL, PRIMARY KEY(tenant_id,lot_id,id), INDEX(tenant_id,lot_id,occurred_at)
) ENGINE=InnoDB;
