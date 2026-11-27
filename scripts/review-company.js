import 'dotenv/config';
import {createMySqlPool} from '../src/shared/infrastructure/persistence/mysql.js';
import {transaction} from '../src/shared/infrastructure/persistence/transaction.js';
import {randomUUID} from 'node:crypto';

const [id,decision,note]=process.argv.slice(2);
if(!id||!['approve','reject'].includes(decision)||!note?.trim()||note.length>500) throw Error('Uso: node scripts/review-company.js ID approve|reject "Referencia de verificación empresarial y del titular del correo"');
const pool=createMySqlPool(process.env.DATABASE_URL);
try {
  await transaction(pool,async db=>{
    const [[request]]=await db.execute('SELECT * FROM corporate_requests WHERE id=? FOR UPDATE',[id]);
    if(request?.status!=='Pending') throw Error('Solicitud no disponible para revisión');
    if(decision==='approve'){
      const actor=randomUUID();
      await db.execute('INSERT INTO app_users(id,tenant_id,email,password_hash) VALUES(?,?,?,?)',[actor,id,request.email,request.password_hash]);
      await db.execute("INSERT INTO app_user_roles(user_id,role_name) VALUES(?,'Administrator')",[actor]);
    }
    await db.execute('UPDATE corporate_requests SET status=?,password_hash=NULL,review_note=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',[decision==='approve'?'Approved':'Rejected',note,id]);
  });
  console.log('Revisión registrada');
} finally { await pool.end(); }
