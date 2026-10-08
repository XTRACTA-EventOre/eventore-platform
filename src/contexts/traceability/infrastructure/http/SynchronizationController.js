import {
    InvalidSynchronizationRequestError
} from '../../application/errors/InvalidSynchronizationRequestError.js';

export function createSynchronizationController({
                                                    synchronizeEvents
                                                }) {
    if (typeof synchronizeEvents?.execute !== 'function') {
        throw new TypeError(
            'SynchronizeEvents use case is required'
        );
    }

    return async function synchronize(request, response) {
        const identity = request.identity;

        if (
            typeof identity?.tenantId !== 'string' ||
            typeof identity?.userId !== 'string'
        ) {
            return response.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication is required'
                }
            });
        }

        try {
            const result = await synchronizeEvents.execute({
                tenantId: identity.tenantId,
                actorId: identity.userId,
                sourceId: request.body?.sourceId,
                events: request.body?.events
            });

            return response.status(200).json(result);
        } catch (error) {
            if (
                error instanceof InvalidSynchronizationRequestError
            ) {
                return response.status(400).json({
                    error: {
                        code: error.code,
                        message: error.message
                    }
                });
            }

            return response.status(503).json({
                error: {
                    code: 'SYNCHRONIZATION_NOT_CONFIRMED',
                    message:
                        'Synchronization could not be confirmed. ' +
                        'Retry using the original event identifiers.'
                }
            });
        }
    };
}