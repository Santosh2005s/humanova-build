import { CommunityRequest, ResourceItem } from '../types';

export interface ResourceSummary {
  resource: ResourceItem;
  totalRequested: number;
  totalAllocated: number;
  availableStock: number; // totalAvailable - totalAllocated
  shortageDeficit: number; // max(0, totalRequested - totalAvailable)
  hasShortage: boolean;
  affectedRequestCount: number;
  affectedRequests: Array<{
    id: string;
    trackingCode: string;
    title: string;
    quantityNeeded: number;
    quantityAllocated: number;
    shortfall: number;
  }>;
}

export interface CommunityResourceMetrics {
  totalRequests: number;
  activeRequests: number;
  blockedRequestsCount: number;
  awaitingConfirmationCount: number;
  resolvedRequestsCount: number;
  criticalShortageCount: number;
  resourcesSummary: ResourceSummary[];
}

/**
 * Deterministically balances resources across all community requests.
 * Allocates available inventory to requests in order of urgency (critical -> high -> medium -> low)
 * and then submission timestamp.
 */
export function recalculateResourceAllocations(
  requests: CommunityRequest[],
  inventory: ResourceItem[]
): {
  updatedRequests: CommunityRequest[];
  updatedInventory: ResourceItem[];
  metrics: CommunityResourceMetrics;
} {
  const safeQuantity = (quantity: number, fallback = 0) =>
    Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : fallback;

  // Deep clone requests to compute clean allocation without mutating in-place
  const updatedRequests = requests.map((req) => ({
    ...req,
    resourcesNeeded: req.resourcesNeeded.map((rn) => ({
      ...rn,
      quantityNeeded: Math.max(1, safeQuantity(rn.quantityNeeded, 1)),
      quantityAllocated: 0,
      isSatisfied: false
    }))
  }));

  const safeInventory = inventory.map((res) => ({
    ...res,
    totalAvailable: safeQuantity(res.totalAvailable)
  }));

  // Track remaining stock to allocate per resource ID
  const remainingStockMap = new Map<string, number>();
  const totalAllocatedMap = new Map<string, number>();

  safeInventory.forEach((res) => {
    remainingStockMap.set(res.id, res.totalAvailable);
    totalAllocatedMap.set(res.id, 0);
  });

  // Sort requests for fair and urgent priority allocation:
  // Resolved or cancelled requests do not consume current available stock once finished,
  // but active requests (open, planned, assigned, in_progress, blocked, awaiting_confirmation) do.
  const activeRequests = updatedRequests.filter(
    (r) => r.status !== 'resolved' && r.status !== 'cancelled'
  );

  const urgencyWeight: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  activeRequests.sort((a, b) => {
    const diff = (urgencyWeight[b.urgency] || 1) - (urgencyWeight[a.urgency] || 1);
    if (diff !== 0) return diff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Perform allocation
  activeRequests.forEach((req) => {
    req.resourcesNeeded.forEach((resReq) => {
      const remaining = remainingStockMap.get(resReq.resourceId) || 0;
      const allocated = Math.min(remaining, resReq.quantityNeeded);

      resReq.quantityAllocated = allocated;
      resReq.isSatisfied = allocated >= resReq.quantityNeeded;

      remainingStockMap.set(resReq.resourceId, remaining - allocated);
      totalAllocatedMap.set(
        resReq.resourceId,
        (totalAllocatedMap.get(resReq.resourceId) || 0) + allocated
      );
    });
  });

  // Update inventory records
  const updatedInventory = safeInventory.map((res) => ({
    ...res,
    allocated: totalAllocatedMap.get(res.id) || 0
  }));

  // Compute resource summaries & shortage metrics
  const resourcesSummary: ResourceSummary[] = updatedInventory.map((res) => {
    let totalRequested = 0;
    const affectedRequests: ResourceSummary['affectedRequests'] = [];

    activeRequests.forEach((req) => {
      const match = req.resourcesNeeded.find((r) => r.resourceId === res.id);
      if (match) {
        totalRequested += match.quantityNeeded;
        if (!match.isSatisfied) {
          affectedRequests.push({
            id: req.id,
            trackingCode: req.trackingCode,
            title: req.title,
            quantityNeeded: match.quantityNeeded,
            quantityAllocated: match.quantityAllocated,
            shortfall: match.quantityNeeded - match.quantityAllocated
          });
        }
      }
    });

    const shortageDeficit = Math.max(0, totalRequested - res.totalAvailable);

    return {
      resource: res,
      totalRequested,
      totalAllocated: res.allocated,
      availableStock: Math.max(0, res.totalAvailable - res.allocated),
      shortageDeficit,
      hasShortage: shortageDeficit > 0,
      affectedRequestCount: affectedRequests.length,
      affectedRequests
    };
  });

  const criticalShortageCount = resourcesSummary.filter((s) => s.hasShortage).length;

  const metrics: CommunityResourceMetrics = {
    totalRequests: requests.length,
    activeRequests: requests.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled').length,
    blockedRequestsCount: requests.filter((r) => r.status === 'blocked').length,
    awaitingConfirmationCount: requests.filter((r) => r.status === 'awaiting_confirmation').length,
    resolvedRequestsCount: requests.filter((r) => r.status === 'resolved').length,
    criticalShortageCount,
    resourcesSummary
  };

  return {
    updatedRequests,
    updatedInventory,
    metrics
  };
}
