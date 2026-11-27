CREATE TABLE IF NOT EXISTS subscriptions (
 tenant_id CHAR(36) PRIMARY KEY, plan VARCHAR(20) NOT NULL DEFAULT 'Base',
 cycle_end DATETIME NOT NULL, next_plan VARCHAR(20)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS billing_orders (
 id CHAR(36) PRIMARY KEY, tenant_id CHAR(36) NOT NULL, target VARCHAR(20) NOT NULL,
 amount_minor INT NOT NULL, currency CHAR(3) NOT NULL, status VARCHAR(20) NOT NULL,
 provider_ref VARCHAR(160) UNIQUE, period_start DATETIME, period_end DATETIME,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(tenant_id,created_at)
) ENGINE=InnoDB;
