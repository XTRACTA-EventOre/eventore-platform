import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { OperationError } from '../../shared/application/OperationError.js';
export async function renderCertificatePdf(certificate,publicUrl){
  const qr=await QRCode.toBuffer(publicUrl,{width:220,errorCorrectionLevel:'M'});
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:48,info:{Title:`EventOre ${certificate.certificateId}`,Author:'EventOre'}}),chunks=[];
    doc.on('data',chunk=>chunks.push(chunk));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.rect(0,0,596,14).fill('#173f3b');doc.fillColor('#173f3b').font('Helvetica-Bold').fontSize(26).text('EventOre');
    doc.moveDown(.4).fontSize(17).text('Certificado de trazabilidad');
    doc.moveDown().fillColor('#172927').font('Helvetica').fontSize(10).text(`Certificado: ${certificate.certificateId}`);
    doc.text(`Joya: ${certificate.product.name}`);doc.text(`Versión de composición: ${certificate.product.compositionVersion}`);
    doc.text(`Emisor: ${certificate.issuer}`);doc.text(`Emisión: ${new Date(certificate.issuedAt).toISOString()}`);
    doc.moveDown().font('Helvetica-Bold').text('Alcance');doc.font('Helvetica').text('Trazabilidad y evidencia revisadas dentro de EventOre. Este documento no certifica por sí mismo composición química, legalidad ni autenticidad física del objeto.');
    doc.moveDown().font('Helvetica-Bold').text('Materiales de la composición revisada');doc.font('Helvetica');
    for(const material of certificate.materials)doc.text(`${material.mineralType} · ${material.quantityGrams} g · evidencia verificada`);
    const y=Math.max(doc.y+24,390);if(y>620)doc.addPage();
    doc.image(qr,48,doc.y+24,{width:125});const qrY=doc.y+24;
    doc.font('Helvetica-Bold').text('Consulta el estado vigente',190,qrY+14,{width:350});
    doc.font('Helvetica').text('El estado puede cambiar después de la emisión. Escanea el QR antes de confiar en este certificado.',190,qrY+38,{width:340});
    doc.fillColor('#173f3b').fontSize(9).text(publicUrl,48,qrY+145,{width:500,link:publicUrl});
    doc.end();
  });
}
export class CertificatePdfJobs{
  constructor({pool,service,appBaseUrl,render=renderCertificatePdf,waitMs=5000}){Object.assign(this,{pool,service,appBaseUrl,render,waitMs});this.active=new Map();}
  async get(tenantId,id){
    await this.service.get(tenantId,id);
    const certificate=await this.service.publicStatus(id);
    if(certificate.status!=='Issued')throw new OperationError(409,'CERTIFICATE_NOT_CURRENT','El certificado no tiene una emisión vigente confirmada');
    const[[existing]]=await this.pool.execute('SELECT state,content FROM certificate_pdf_jobs WHERE tenant_id=? AND certificate_id=?',[tenantId,id]);
    if(existing?.state==='Ready')return {state:'Ready',content:existing.content};
    const key=`${tenantId}:${id}`;
    if(!this.active.has(key)){
      await this.pool.execute("INSERT INTO certificate_pdf_jobs(tenant_id,certificate_id,state) VALUES(?,?,'Pending') ON DUPLICATE KEY UPDATE state='Pending'",[tenantId,id]);
      const job=(async()=>{
        try{const content=await this.render(certificate,new URL(`/verify/${id}`,this.appBaseUrl).href);
          await this.pool.execute("UPDATE certificate_pdf_jobs SET state='Ready',content=?,updated_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND certificate_id=?",[content,tenantId,id]);return {state:'Ready',content};
        }catch{await this.pool.execute("UPDATE certificate_pdf_jobs SET state='Failed',updated_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND certificate_id=?",[tenantId,id]).catch(()=>{});return {state:'Failed'};}
        finally{this.active.delete(key);}
      })();this.active.set(key,job);
    }
    let timer;try{return await Promise.race([this.active.get(key),new Promise(resolve=>{timer=setTimeout(()=>resolve({state:'Pending'}),this.waitMs);})]);}finally{clearTimeout(timer);}
  }
}
