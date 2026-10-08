import { ensureLotIsActive } from '../../../domain/services/cancellation/EnsureLotIsActive.js';

export class GetMineralLotQr {
    constructor({ getMineralLotDetails,base,encode }) {
        Object.assign(this,{ getMineralLotDetails,base,encode });
    }
    async execute({ lotId,tenantId }) {
        const lot = await this.getMineralLotDetails.execute({ lotId,tenantId });
        ensureLotIsActive({ status: lot.status });
        const url = new URL(`/lots/${encodeURIComponent(lot.lotId)}`,this.base).href;
        return this.encode(url);
    }
}
