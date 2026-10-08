import { Router } from 'express';

const healthRouter = Router();

healthRouter.get('/', (request, response) => {
    return response.status(200).json({
        status: 'ok',
        service: 'eventore-api'
    });
});

export { healthRouter };