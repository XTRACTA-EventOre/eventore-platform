import { Router } from 'express';

import {
    createSynchronizationController
} from './SynchronizationController.js';

export function createSynchronizationRouter({
                                                synchronizeEvents,
                                                authenticate
                                            }) {
    if (typeof authenticate !== 'function') {
        throw new TypeError(
            'Authentication middleware is required'
        );
    }

    const router = Router();

    const controller = createSynchronizationController({
        synchronizeEvents
    });

    router.post(
        '/synchronize',
        authenticate,
        controller
    );

    return router;
}