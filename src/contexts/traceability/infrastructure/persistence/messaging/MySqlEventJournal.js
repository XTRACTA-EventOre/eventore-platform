export class MySqlEventJournal {
  async reserve({ tx, envelope }) {
    const key = [envelope.tenantId, envelope.clientEventId];
    try {
      await tx.execute(`INSERT INTO event_inbox
        (tenant_id,client_event_id,envelope) VALUES (?,?,?)`, [...key, JSON.stringify(envelope)]);
      return { fresh: true, envelope, outcome: null };
    } catch (error) {
      // Ignore only a duplicate primary key, never validation/connection/other SQL errors.
      if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
    // READ COMMITTED sees the winner's outcome after the unique-key insert waited.
    const [rows] = await tx.execute(`SELECT envelope,outcome FROM event_inbox
      WHERE tenant_id=? AND client_event_id=?`, key);
    if (!rows[0]?.outcome) throw new Error('Evento aún no confirmado');
    return { fresh: false, ...rows[0] };
  }
  async complete({ tx, envelope, outcome }) {
    const [result] = await tx.execute(`UPDATE event_inbox SET outcome=?
      WHERE tenant_id=? AND client_event_id=? AND outcome IS NULL`,
      [JSON.stringify(outcome), envelope.tenantId, envelope.clientEventId]);
    if (result.affectedRows !== 1) throw new Error('No se pudo confirmar el evento');
  }
  appendOutbox({ tx, envelope, lotId, messageId }) {
    return tx.execute(`INSERT INTO event_outbox
      (id,tenant_id,client_event_id,lot_id,payload) VALUES (?,?,?,?,?)`,
      [messageId, envelope.tenantId, envelope.clientEventId, lotId, JSON.stringify({ ...envelope, lotId })]);
  }
  async listPending({ tx, tenantId }) {
    const [rows] = await tx.execute(`SELECT * FROM event_outbox
      WHERE tenant_id=? AND published_at IS NULL ORDER BY created_at,id`, [tenantId]);
    return rows;
  }
  markPublished({ tx, tenantId, messageId }) {
    return tx.execute(`UPDATE event_outbox SET published_at=UTC_TIMESTAMP(3)
      WHERE tenant_id=? AND id=? AND published_at IS NULL`, [tenantId, messageId]);
  }
}
