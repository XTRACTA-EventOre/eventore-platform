export async function up(tx) {
  const [checks] = await tx.query(`SELECT CONSTRAINT_NAME AS name,CHECK_CLAUSE AS clauseText
    FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()`);
  if (checks.some(check => check.name === 'user_role_allowed')) return;
  for (const check of checks.filter(check => /\brole_name\b/.test(check.clauseText))) {
    if (!/^[a-zA-Z0-9_]+$/.test(check.name)) throw new Error('Restricción inesperada');
    await tx.query(`ALTER TABLE app_user_roles DROP CHECK \`${check.name}\``);
  }
  await tx.query("ALTER TABLE app_user_roles ADD CONSTRAINT user_role_allowed CHECK (role_name IN ('Administrator','Supervisor','Operator','Transporter','Viewer','PlantOperator','Jeweler','Certifier'))");
}
