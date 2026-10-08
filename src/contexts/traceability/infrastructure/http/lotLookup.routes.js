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
        controller
    );

    return router;
}