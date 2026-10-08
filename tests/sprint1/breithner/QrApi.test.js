import { describe,test,expect } from '@jest/globals';
import request from 'supertest';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { createQrRouter } from '../../../src/contexts/traceability/infrastructure/http/qr/qr.routes.js';
import { makeMemoryRuntime,makeApp,payload,clientEventId } from './fixtures.js';

function binary(res,done) {
    const chunks = []; res.on('data',c => chunks.push(c));
    res.on('end',() => done(null,Buffer.concat(chunks)));
    res.on('error',done);
}
async function setup() {
    const runtime = makeMemoryRuntime(); const appData = makeApp(runtime);
    appData.app.use('/api/v1/lots',createQrRouter({ ...appData,
        appBaseUrl: 'http://localhost:5173' }));
    const created = await request(appData.app).post('/api/v1/lots')
        .send({ clientEventId,...payload });
    return { ...appData,runtime,lotId: created.body.lotId };
}
describe('ET20 QR',() => {
    test('el PNG contiene la URL del lote correcto',async () => {
        const { app,lotId } = await setup();
        const res = await request(app).get(`/api/v1/lots/${lotId}/qr`)
            .buffer(true).parse(binary);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/image\/png/);
        const png = PNG.sync.read(res.body);
        const decoded = jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
        expect(decoded?.data).toBe(`http://localhost:5173/lots/${lotId}`);
    });
    test('QR previo consulta Cancelled y se bloquea nueva emisión',async () => {
        const { app,runtime,lotId } = await setup();
        const lot = runtime.data.lots.get(lotId); lot.status = 'Cancelled';
        const lookup = await request(app).get(`/api/v1/lots/${lotId}`);
        expect(lookup.body).toMatchObject({ status: 'Cancelled',
            transportStatus: 'Blocked',qrProvesOrigin: false });
        expect((await request(app).get(`/api/v1/lots/${lotId}/qr`)).status).toBe(409);
    });
    test('UUID inválido devuelve 400',async () => {
        const { app } = await setup();
        expect((await request(app).get('/api/v1/lots/invalid/qr')).status).toBe(400);
    });
});
