CREATE TABLE mineral_lots (
  id uuid NOT NULL, tenant_id uuid NOT NULL,
  mineral_type text NOT NULL, weight numeric NOT NULL CHECK (weight > 0),
  weight_unit text NOT NULL CHECK (weight_unit IN ('g','kg','t')),
  status text NOT NULL CHECK (status IN ('Registered','Cancelled')),
  version integer NOT NULL CHECK (version > 0), created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,id)
);
CREATE TABLE origin_evidence (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, lot_id uuid NOT NULL,
  reference text NOT NULL, source text NOT NULL,
  review_status text NOT NULL DEFAULT 'PendingReview'
    CHECK (review_status IN ('PendingReview','Verified','Rejected')),
  UNIQUE (tenant_id,lot_id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
);
CREATE TABLE trace_events (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, lot_id uuid NOT NULL,
  client_event_id uuid NOT NULL, source_id text NOT NULL,
  event_type text NOT NULL, occurred_at timestamptz NOT NULL, payload jsonb NOT NULL,
  UNIQUE (tenant_id,client_event_id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
);
