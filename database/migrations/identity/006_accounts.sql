CREATE TABLE IF NOT EXISTS corporate_requests (
 id CHAR(36) PRIMARY KEY, company_id VARCHAR(32) UNIQUE NOT NULL, company_name VARCHAR(160) NOT NULL,
 email VARCHAR(254) NOT NULL, password_hash VARCHAR(256), evidence VARCHAR(500) NOT NULL,
 status VARCHAR(12) NOT NULL DEFAULT 'Pending', review_note VARCHAR(500), reviewed_at DATETIME
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS account_challenges (
 user_id CHAR(36) NOT NULL, purpose VARCHAR(16) NOT NULL, token_hash CHAR(64) NOT NULL,
 expires_at DATETIME(3) NOT NULL, sent_at DATETIME(3) NOT NULL, attempts INT NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,purpose)
) ENGINE=InnoDB;
