/**
 * @typedef {'Accepted' | 'AlreadyProcessed' |
 * 'Conflict' | 'Rejected'} ProcessingStatus
 */

/**
 * @typedef {Object} EventProcessingResult
 * @property {ProcessingStatus} status
 * @property {string} [lotId]
 * @property {string | null} [reason]
 */

/**
 * Port for processing traceability events.
 *
 * The application layer owns this contract.
 * Infrastructure will provide an implementation.
 *
 * @typedef {Object} EventProcessor
 * @property {(
 *   context: {
 *     tenantId: string,
 *     actorId: string,
 *     sourceId: string,
 *     event: Object
 *   }
 * ) => Promise<EventProcessingResult>} process
 */

export {};