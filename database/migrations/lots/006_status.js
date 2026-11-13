// MySQL DDL commits implicitly. Inspect constraints so this step can resume after interruption.
export async function up(tx) {
  const [checks] = await tx.query(`SELECT tc.CONSTRAINT_NAME AS name,cc.CHECK_CLAUSE AS clauseText
    FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
    ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA=DATABASE() AND tc.TABLE_NAME='mineral_lots' AND tc.CONSTRAINT_TYPE='CHECK'`);
  if (checks.some(check => check.name === 'lot_status_allowed')) return;
  for (const check of checks.filter(check => /\bstatus\b/.test(check.clauseText))) {
    if (!/^[a-zA-Z0-9_]+$/.test(check.name)) throw new Error('Nombre de restricción inesperado');
    await tx.query(`ALTER TABLE mineral_lots DROP CHECK \`${check.name}\``);
  }
  await tx.query("ALTER TABLE mineral_lots ADD CONSTRAINT lot_status_allowed CHECK (status IN ('Registered','Cancelled','InTransit'))");
}
