import 'dotenv/config';
import {createMySqlPool} from '../src/shared/infrastructure/persistence/mysql.js';
import {reviewCompany} from '../src/services/identity/reviewCompany.js';

const [id,decision,note]=process.argv.slice(2);
if(!id||!['approve','reject'].includes(decision)||!note?.trim()||note.length>500) throw Error('Uso: node scripts/review-company.js ID approve|reject "Referencia de verificación empresarial y del titular del correo"');
const pool=createMySqlPool(process.env.DATABASE_URL);
try {
  await reviewCompany(pool,id,decision,note);
  console.log('Revisión registrada');
} finally { await pool.end(); }
