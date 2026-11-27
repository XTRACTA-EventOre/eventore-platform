import {randomUUID} from 'node:crypto';
import {transaction} from '../../shared/infrastructure/persistence/transaction.js';
import {text,uuid} from '../../shared/infrastructure/http/operationHttp.js';

export async function reviewCompany(pool,id,decision,note){
  uuid(id);text(note,'Referencia de verificación',500);
  if(!['approve','reject'].includes(decision))throw Error('Selecciona approve o reject');
  await transaction(pool,async db=>{
    const [[record]]=await db.execute('SELECT * FROM corporate_requests WHERE id=? FOR UPDATE',[id]);
    if(record?.status!=='Pending')throw Error('Solicitud no disponible para revisión');
    const approved=decision==='approve';
    if(approved){
      const userId=randomUUID();
      await db.execute('INSERT INTO app_users(id,tenant_id,email,password_hash) VALUES(?,?,?,?)',[userId,id,record.email,record.password_hash]);
      await db.execute("INSERT INTO app_user_roles(user_id,role_name) VALUES(?,'Administrator')",[userId]);
    }
    await db.execute('UPDATE corporate_requests SET status=?,password_hash=NULL,review_note=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',[approved?'Approved':'Rejected',note,id]);
  });
}
