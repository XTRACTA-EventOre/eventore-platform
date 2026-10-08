import { Router } from 'express';
import { assertUuid } from '../../../domain/validation/domainAssertions.js';
import { DomainError } from '../../../domain/errors/DomainError.js';

export function createRegistrationRouter({ processor,getMineralLotDetails,authenticate }) {
    if (typeof authenticate !== 'function') throw new Error('Falta autenticación');
    const router = Router();
    router.post('/',authenticate,async (req,res) => {
        const identity = req.identity;
        if (!identity?.tenantId || !identity?.userId?.trim()) {
            return res.status(401).json({ error: {
                    code: 'UNAUTHORIZED',message: 'Se requiere una sesión' } });
        }
        try {
            const tenantId = assertUuid(identity.tenantId,'tenantId').toLowerCase();
            const clientEventId = assertUuid(req.body?.clientEventId,'clientEventId');
            const { mineralType,weight,weightUnit,originEvidence } = req.body ?? {};
            const outcome = await processor.register({ tenantId,
                actorId: identity.userId,clientEventId,
                payload: JSON.parse(JSON.stringify({ mineralType,weight,weightUnit,originEvidence })) });
            if (['Accepted','AlreadyProcessed'].includes(outcome.status)) {
                const current = outcome.status === 'AlreadyProcessed'
                    ? await getMineralLotDetails.execute({ lotId: outcome.lotId,tenantId }) : null;
                return res.status(current ? 200 : 201).json({
                    lotId: outcome.lotId,status: current?.status ?? 'Registered',
                    version: current?.version ?? 1,
                    originEvidenceStatus: current?.originEvidenceStatus ?? 'PendingReview' });
            }
            return res.status(outcome.status === 'Conflict' ? 409 : 400).json({
                error: { code: outcome.reason,message: 'No se pudo registrar el lote' } });
        } catch (error) {
            if (error instanceof DomainError) {
                return res.status(400).json({ error: { code: error.code,message: error.message } });
            }
            return res.status(503).json({ error: {
                    code: 'REGISTRATION_NOT_CONFIRMED',message: 'Reintenta con el mismo ID' } });
        }
    });
    return router;
}
