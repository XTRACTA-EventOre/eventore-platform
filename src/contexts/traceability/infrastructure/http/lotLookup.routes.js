import { requirePermission } from '../../../../shared/infrastructure/http/permissions.js';
import { Router } from 'express';

import {
    createLotLookupController
} from './LotLookupController.js';

export function createLotLookupRouter({
                                          getMineralLotDetails,
                                          authenticate
                                      }) {
    if (typeof authenticate !== 'function') {
        throw new TypeError(
            'Authentication middleware is required'
        );
    }

    const router = Router();

    const controller = createLotLookupController({
        getMineralLotDetails
    });

    router.get(
        '/:lotId',
        authenticate,
        requirePermission('lots.read'),
        controller
    );

    return router;
}
