CREATE TABLE IF NOT EXISTS certificates (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 product_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, product_version INT NOT NULL, version INT NOT NULL,
 status VARCHAR(24) NOT NULL, requested_by CHAR(36) NOT NULL, issuer_name VARCHAR(200), reviewed_by CHAR(36),
 evidence_hash CHAR(64), published_summary JSON NOT NULL, issued_at DATETIME(3),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(tenant_id,id), UNIQUE KEY public_certificate_id(id), INDEX certificate_product(tenant_id,product_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS certificate_operations (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 certificate_id CHAR(36) NOT NULL, actor_id CHAR(36) NOT NULL, action VARCHAR(30) NOT NULL, command JSON NOT NULL, result JSON NOT NULL,
 occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,operation_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS certificate_pdf_jobs (
 tenant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, certificate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state VARCHAR(16) NOT NULL, content LONGBLOB, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(tenant_id,certificate_id)
) ENGINE=InnoDB;
