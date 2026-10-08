import {
    describe,
    expect,
    jest,
    test
} from '@jest/globals';

import {
    GetMineralLotDetails
} from '../../../../src/contexts/traceability/application/use-cases/GetMineralLotDetails.js';

import {
    InvalidLotLookupError
} from '../../../../src/contexts/traceability/application/errors/InvalidLotLookupError.js';

import {
    MineralLotNotFoundError
} from '../../../../src/contexts/traceability/application/errors/MineralLotNotFoundError.js';

const TENANT_ID =
    '11111111-1111-4111-8111-111111111111';

const LOT_ID =
    '22222222-2222-4222-8222-222222222222';

function createReadModel(overrides = {}) {
    return {
        id: LOT_ID,
        tenantId: TENANT_ID,
        mineralType: 'Gold',
        weight: '125.50',
        weightUnit: 'kg',
        status: 'Registered',
        version: 1,
        originEvidenceStatus: 'PendingReview',
        ...overrides
    };
}

function createUseCase(readModel) {
    const findById = jest.fn().mockResolvedValue(readModel);

    return {
        useCase: new GetMineralLotDetails({
            mineralLotReader: { findById }
        }),
        findById
    };
}

describe('GetMineralLotDetails', () => {
    test('returns the registered mineral lot', async () => {
        const { useCase, findById } = createUseCase(
            createReadModel()
        );

        const result = await useCase.execute({
            lotId: LOT_ID,
            tenantId: TENANT_ID
        });

        expect(result).toEqual({
            lotId: LOT_ID,
            mineralType: 'Gold',
            weight: '125.50',
            weightUnit: 'kg',
            status: 'Registered',
            version: 1,
            originEvidenceStatus: 'PendingReview',
            transportStatus: 'RequiresValidation',
            qrProvesOrigin: false
        });

        expect(findById).toHaveBeenCalledWith({
            lotId: LOT_ID,
            tenantId: TENANT_ID
        });
    });

    test('blocks transport indication for cancelled lots', async () => {
        const { useCase } = createUseCase(
            createReadModel({
                status: 'Cancelled',
                version: 2
            })
        );

        const result = await useCase.execute({
            lotId: LOT_ID,
            tenantId: TENANT_ID
        });

        expect(result.status).toBe('Cancelled');
        expect(result.transportStatus).toBe('Blocked');
    });

    test('does not treat verified evidence as QR proof', async () => {
        const { useCase } = createUseCase(
            createReadModel({
                originEvidenceStatus: 'Verified'
            })
        );

        const result = await useCase.execute({
            lotId: LOT_ID,
            tenantId: TENANT_ID
        });

        expect(result.originEvidenceStatus).toBe('Verified');
        expect(result.qrProvesOrigin).toBe(false);
    });

    test('rejects an invalid lot identifier', async () => {
        const { useCase, findById } = createUseCase(null);

        await expect(
            useCase.execute({
                lotId: 'invalid-id',
                tenantId: TENANT_ID
            })
        ).rejects.toThrow(InvalidLotLookupError);

        expect(findById).not.toHaveBeenCalled();
    });

    test('returns not found when the lot does not exist', async () => {
        const { useCase } = createUseCase(null);

        await expect(
            useCase.execute({
                lotId: LOT_ID,
                tenantId: TENANT_ID
            })
        ).rejects.toThrow(MineralLotNotFoundError);
    });

    test('does not expose another tenant lot', async () => {
        const otherTenant =
            '33333333-3333-4333-8333-333333333333';

        const { useCase } = createUseCase(
            createReadModel({
                tenantId: otherTenant
            })
        );

        await expect(
            useCase.execute({
                lotId: LOT_ID,
                tenantId: TENANT_ID
            })
        ).rejects.toThrow(MineralLotNotFoundError);
    });

    test('rejects a mismatched lot record', async () => {
        const { useCase } = createUseCase(
            createReadModel({
                id: '44444444-4444-4444-8444-444444444444'
            })
        );

        await expect(
            useCase.execute({
                lotId: LOT_ID,
                tenantId: TENANT_ID
            })
        ).rejects.toThrow(MineralLotNotFoundError);
    });

    test('rejects invalid repository read models', async () => {
        const { useCase } = createUseCase(
            createReadModel({
                status: 'Unknown'
            })
        );

        await expect(
            useCase.execute({
                lotId: LOT_ID,
                tenantId: TENANT_ID
            })
        ).rejects.toThrow('Invalid mineral lot read model');
    });

    test('propagates repository failures', async () => {
        const findById = jest.fn().mockRejectedValue(
            new Error('Database unavailable')
        );

        const useCase = new GetMineralLotDetails({
            mineralLotReader: { findById }
        });

        await expect(
            useCase.execute({
                lotId: LOT_ID,
                tenantId: TENANT_ID
            })
        ).rejects.toThrow('Database unavailable');
    });
});