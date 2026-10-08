CREATE TABLE event_inbox (
                             tenant_id uuid NOT NULL, client_event_id uuid NOT NULL,
                             envelope jsonb NOT NULL, outcome jsonb,
                             received_at timestamptz NOT NULL DEFAULT now(),
                             PRIMARY KEY (tenant_id,client_event_id)
);
CREATE TABLE event_outbox (
                              id uuid PRIMARY KEY, tenant_id uuid NOT NULL, client_event_id uuid NOT NULL,
                              lot_id uuid NOT NULL, payload jsonb NOT NULL,
                              created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
                              UNIQUE (tenant_id,client_event_id),
                              FOREIGN KEY (tenant_id,client_event_id)
                                  REFERENCES event_inbox(tenant_id,client_event_id),
                              FOREIGN KEY (tenant_id,lot_id) REFERENCES mineral_lots(tenant_id,id)
);
