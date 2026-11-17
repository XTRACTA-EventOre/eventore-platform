export async function up(tx) {
  const [checks] = await tx.query(`SELECT CONSTRAINT_NAME AS name FROM information_schema.CHECK_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='lot_state_v2'`);
  if (checks.length) return;
  const [previous] = await tx.query(`SELECT CONSTRAINT_NAME AS name,CHECK_CLAUSE AS clauseText FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()`);
  for (const check of previous.filter(check => /\bstatus\b/.test(check.clauseText))) {
    if (!/^[a-zA-Z0-9_]+$/.test(check.name)) throw new Error('Restricción inesperada');
    await tx.query(`ALTER TABLE mineral_lots DROP CHECK \`${check.name}\``);
  }
  await tx.query("ALTER TABLE mineral_lots ADD CONSTRAINT lot_state_v2 CHECK (status IN ('Registered','Cancelled','InTransit','Received','Processing','Processed','Consumed','AtJewelry'))");
}
