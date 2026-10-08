/**
 * @typedef {Object} MineralLotReadModel
 * @property {string} id
 * @property {string} tenantId
 * @property {string} mineralType
 * @property {string} weight
 * @property {'g' | 'kg' | 't'} weightUnit
 * @property {'Registered' | 'Cancelled'} status
 * @property {number} version
 * @property {'PendingReview' | 'Verified' | 'Rejected'} originEvidenceStatus
 */

/**
 * Port for retrieving mineral lot information.
 *
 * Implementations must scope queries to the authenticated tenant.
 *
 * @typedef {Object} MineralLotReader
 * @property {(
 *   criteria: {
 *     lotId: string,
 *     tenantId: string
 *   }
 * ) => Promise<MineralLotReadModel | null>} findById
 */

export {};