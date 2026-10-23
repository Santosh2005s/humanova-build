import { useEffect, useState } from 'react';
import { CommunityRequest, NeedCategory, ResourceItem, TaskStatus, UrgencyLevel, Volunteer } from '../types';
import { CommunityResourceMetrics } from './resourceEngine';
import { ApiError, apiRequest } from './apiClient';

export interface HumanovaSnapshot {
  requests: CommunityRequest[];
  resources: ResourceItem[];
  volunteers: Volunteer[];
  metrics: CommunityResourceMetrics;
  loading: boolean;
  error: string | null;
}

const emptyMetrics: CommunityResourceMetrics = {
  totalRequests: 0,
  activeRequests: 0,
  blockedRequestsCount: 0,
  awaitingConfirmationCount: 0,
  resolvedRequestsCount: 0,
  criticalShortageCount: 0,
  resourcesSummary: []
};

const emptyState = (): HumanovaSnapshot => ({
  requests: [],
  resources: [],
  volunteers: [],
  metrics: emptyMetrics,
  loading: true,
  error: null
});

type Listener = () => void;
const listeners = new Set<Listener>();
let currentState = emptyState();
let hasLoaded = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function setError(error: unknown) {
  currentState = {
    ...currentState,
    loading: false,
    error: error instanceof Error ? error.message : 'The request could not be completed.'
  };
  notify();
}

async function reloadAfter<T>(action: () => Promise<T>): Promise<T> {
  const result = await action();
  await HumanovaStore.loadState();
  return result;
}

export const HumanovaStore = {
  getState(): HumanovaSnapshot {
    return currentState;
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async loadState(): Promise<void> {
    currentState = { ...currentState, loading: !hasLoaded, error: null };
    notify();
    try {
      const state = await apiRequest<Omit<HumanovaSnapshot, 'loading' | 'error'>>('/api/state');
      hasLoaded = true;
      currentState = { ...state, loading: false, error: null };
    } catch (error) {
      currentState = {
        ...emptyState(),
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load Humanova data.'
      };
    }
    notify();
  },

  async resetToDemoScenario(): Promise<void> {
    await reloadAfter(() => apiRequest('/api/demo/reset', { method: 'POST' }));
  },

  async createRequest(data: {
    title: string;
    description: string;
    category: NeedCategory;
    urgency: UrgencyLevel;
    resourceCategory?: NeedCategory;
    locationArea: string;
    recipientName: string;
    recipientContact: string;
    quantityNeeded: number;
    resourceName: string;
    unit: string;
  }): Promise<CommunityRequest> {
    return reloadAfter(() => apiRequest<CommunityRequest>('/api/requests', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        category: data.category,
        urgency: data.urgency,
        locationArea: data.locationArea,
        recipientName: data.recipientName,
        recipientContact: data.recipientContact,
        resourcesNeeded: [{
          resourceName: data.resourceName,
          category: data.resourceCategory || data.category,
          unit: data.unit,
          quantityNeeded: data.quantityNeeded
        }]
      })
    }));
  },

  async replenishResource(resourceId: string, quantity: number): Promise<{ success: boolean; reason?: string }> {
    try {
      await reloadAfter(() => apiRequest(`/api/resources/${encodeURIComponent(resourceId)}/replenish`, {
        method: 'POST',
        body: JSON.stringify({ quantity })
      }));
      return { success: true };
    } catch (error) {
      return { success: false, reason: error instanceof Error ? error.message : 'Inventory could not be updated.' };
    }
  },

  async assignTaskVolunteer(taskId: string, volunteerId: string): Promise<{ success: boolean; reason?: string }> {
    try {
      await reloadAfter(() => apiRequest(`/api/tasks/${encodeURIComponent(taskId)}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ volunteerId })
      }));
      return { success: true };
    } catch (error) {
      return { success: false, reason: error instanceof Error ? error.message : 'Volunteer assignment was rejected.' };
    }
  },

  async updateTaskStatus(taskId: string, status: TaskStatus, notes?: string): Promise<{ success: boolean; reason?: string }> {
    try {
      await reloadAfter(() => apiRequest(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes })
      }));
      return { success: true };
    } catch (error) {
      return { success: false, reason: error instanceof Error ? error.message : 'Task status could not be updated.' };
    }
  },

  async submitRecipientConfirmation(requestId: string, confirmed: boolean, feedback?: string, disputeReason?: string): Promise<void> {
    await reloadAfter(() => apiRequest(`/api/requests/${encodeURIComponent(requestId)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmed, feedback, disputed: !confirmed, disputeReason })
    }));
  },

  async updateVolunteer(volunteerId: string, updates: Partial<Volunteer>): Promise<void> {
    await reloadAfter(() => apiRequest(`/api/volunteers/${encodeURIComponent(volunteerId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        skills: updates.skills,
        serviceAreas: updates.serviceAreas,
        availabilityStatus: updates.availabilityStatus,
        hoursPerWeek: updates.hoursPerWeek
      })
    }));
  },

  getErrorMessage(error: unknown): string {
    return error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'The request could not be completed.';
  }
};

export function useHumanovaStore() {
  const [data, setData] = useState(() => HumanovaStore.getState());

  useEffect(() => {
    const unsubscribe = HumanovaStore.subscribe(() => setData(HumanovaStore.getState()));
    void HumanovaStore.loadState();
    return unsubscribe;
  }, []);

  return data;
}
