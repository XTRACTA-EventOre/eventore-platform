import {
    InvalidLotLookupError
} from '../../application/errors/InvalidLotLookupError.js';

import {
    MineralLotNotFoundError
} from '../../application/errors/MineralLotNotFoundError.js';

export function createLotLookupController({
                                              getMineralLotDetails
                                          }) {
    if (typeof getMineralLotDetails?.execute !== 'function') {
        throw new TypeError(
            'GetMineralLotDetails use case is required'
        );
    }

    return async function getLotDetails(request, response) {
        const identity = request.identity;

        if (
            typeof identity?.tenantId !== 'string' ||
            typeof identity?.userId !== 'string' ||
            !identity.userId.trim()
        ) {
            return response.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication is required'
                }
            });
        }

        try {
            const lot = await getMineralLotDetails.execute({
                lotId: request.params.lotId,
                tenantId: identity.tenantId
            });

            return response.status(200).json(lot);
        } catch (error) {
            if (error instanceof InvalidLotLookupError) {
                return response.status(400).json({
                    error: {
                        code: error.code,
                        message: error.message
                    }
                });
            }

            if (error instanceof MineralLotNotFoundError) {
                return response.status(404).json({
                    error: {
                        code: error.code,
                        message: error.message
                    }
                });
            }

            return response.status(503).json({
                error: {
                    code: 'LOT_LOOKUP_UNAVAILABLE',
                    message: 'Mineral lot lookup is temporarily unavailable'
                }
            });
        }
    };
}