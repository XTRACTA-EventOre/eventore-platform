export const LotStatus = Object.freeze({
    REGISTERED: 'Registered',
    CANCELLED: 'Cancelled',
    IN_TRANSIT: 'InTransit',
    RECEIVED: 'Received',
    PROCESSING: 'Processing',
    PROCESSED: 'Processed',
    CONSUMED: 'Consumed',
    AT_JEWELRY: 'AtJewelry'
});

export const EvidenceReviewStatus = Object.freeze({
    PENDING_REVIEW: 'PendingReview',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected'
});

export const TraceEventType = Object.freeze({
    LOT_REGISTERED: 'LotRegistered'
});

export const WeightUnit = Object.freeze({
    GRAM: 'g',
    KILOGRAM: 'kg',
    TONNE: 't'
});
