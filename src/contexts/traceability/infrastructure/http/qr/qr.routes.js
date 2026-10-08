import { Router } from 'express';
import QRCode from 'qrcode';
import { GetMineralLotQr } from '../../../application/use-cases/qr/GetMineralLotQr.js';

export function createQrRouter({ getMineralLotDetails,authenticate,appBaseUrl,
                                   encode = url => QRCode.toBuffer(url,{ type: 'png',errorCorrectionLevel: 'M' }) }) {
    if (typeof authenticate !== 'function') throw new Error('Falta autenticación');
    const base = new URL(appBaseUrl);
    if (!['http:','https:'].includes(base.protocol)) throw new Error('URL inválida');
    const getQr = new GetMineralLotQr({ getMineralLotDetails,base,encode });
    const router = Router();
    router.get('/:lotId/qr',authenticate,async (req,res) => {
        if (!req.identity?.tenantId || !req.identity?.userId?.trim()) {
            return res.status(401).json({ error: {
                    code: 'UNAUTHORIZED',message: 'Se requiere una sesión' } });
        }
        try {
            const png = await getQr.execute({
                lotId: req.params.lotId,tenantId: req.identity.tenantId });
            res.set('Cache-Control','no-store');
            return res.type('png').send(png);
        } catch (error) {
            const status = error.code === 'LOT_CANCELLED' ? 409 :
                error.code === 'MINERAL_LOT_NOT_FOUND' ? 404 :
                    error.code === 'INVALID_LOT_ID' ? 400 : 503;
            return res.status(status).json({ error: {
                    code: error.code ?? 'QR_UNAVAILABLE',message: 'No se pudo generar el QR' } });
        }
    });
    return router;
}