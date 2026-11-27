export async function transaction(pool,run) {
  const db=await pool.getConnection();
  try {
    await db.beginTransaction();
    const result=await run(db);
    await db.commit();
    return result;
  } catch(error) {
    await db.rollback().catch(()=>{});
    throw error;
  } finally { db.release(); }
}
