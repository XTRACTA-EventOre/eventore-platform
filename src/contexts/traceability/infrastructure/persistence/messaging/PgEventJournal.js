export class PgEventJournal {
    async reserve({ tx,envelope }) {
        const key = [envelope.tenantId,envelope.clientEventId];
        const inserted = await tx.query(`INSERT INTO event_inbox
      (tenant_id,client_event_id,envelope) VALUES ($1,$2,$3)
      ON CONFLICT (tenant_id,client_event_id) DO NOTHING
      RETURNING envelope,outcome`, [...key,JSON.stringify(envelope)]);
        if (inserted.rowCount === 1) {
            return { fresh: true,...inserted.rows[0] };
        }
        const { rows } = await tx.query(`SELECT envelope,outcome FROM event_inbox
      WHERE tenant_id=$1 AND client_event_id=$2`,key);
        if (!rows[0]?.outcome) throw new Error('Evento aún no confirmado');
        return { fresh: false,...rows[0] };
    }
    async complete({ tx,envelope,outcome }) {
        const result = await tx.query(`UPDATE event_inbox SET outcome=$3
      WHERE tenant_id=$1 AND client_event_id=$2 AND outcome IS NULL`,
            [envelope.tenantId,envelope.clientEventId,JSON.stringify(outcome)]);
        if (result.rowCount !== 1) throw new Error('No se pudo confirmar el evento');
    }
    appendOutbox({ tx,envelope,lotId,messageId }) {
        return tx.query(`INSERT INTO event_outbox
      (id,tenant_id,client_event_id,lot_id,payload) VALUES ($1,$2,$3,$4,$5)`,
            [messageId,envelope.tenantId,envelope.clientEventId,lotId,
                JSON.stringify({ ...envelope,lotId })]);
    }
    async listPending({ tx,tenantId }) {
        const { rows } = await tx.query(`SELECT * FROM event_outbox
      WHERE tenant_id=$1 AND published_at IS NULL ORDER BY created_at,id`,[tenantId]);
        return rows;
    }
    markPublished({ tx,tenantId,messageId }) {
        return tx.query(`UPDATE event_outbox SET published_at=now()
      WHERE tenant_id=$1 AND id=$2 AND published_at IS NULL`,[tenantId,messageId]);
    }
}
