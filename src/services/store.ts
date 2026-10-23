import { useEffect, useState } from 'react';
import { INITIAL_REQUESTS, INITIAL_RESOURCES, INITIAL_VOLUNTEERS } from '../data/seedData';
import {
  ActionTask,
  CommunityRequest,
  NeedCategory,
  ResourceItem,
  ResourceRequirement,
  TaskStatus,
  UrgencyLevel,
  Volunteer
} from '../types';
import { generateTasksForRequest, evaluateRequestState, NeedToActionEngine } from './plannerEngine';
import { CommunityResourceMetrics, recalculateResourceAllocations } from './resourceEngine';

const STORAGE_KEY = 'humanova_state_v1';

interface HumanovaState {
  requests: CommunityRequest[];
  resources: ResourceItem[];
  volunteers: Volunteer[];
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

function loadInitialState(): HumanovaState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.requests && parsed.resources && parsed.volunteers) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage, using seeds', e);
  }

  return {
    requests: INITIAL_REQUESTS,
    resources: INITIAL_RESOURCES,
    volunteers: INITIAL_VOLUNTEERS
  };
}

let currentState: HumanovaState = loadInitialState();

function persistState(state: HumanovaState) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.error('Failed to persist state to localStorage', e);
  }
}

/**
 * Normalizes state by running resource allocation and dependency checks.
 */
function normalizeAndBalance(state: HumanovaState): {
  requests: CommunityRequest[];
  resources: ResourceItem[];
  volunteers: Volunteer[];
  metrics: CommunityResourceMetrics;
} {
  // 1. Balance resources and compute shortages
  const { updatedRequests, updatedInventory, metrics } = recalculateResourceAllocations(
    state.requests,
    state.resources
  );

  // 2. Evaluate dependencies and readiness on each request
  const fullyEvaluatedRequests = updatedRequests.map((req) => evaluateRequestState(req));

  return {
    requests: fullyEvaluatedRequests,
    resources: updatedInventory,
    volunteers: state.volunteers,
    metrics
  };
}

export const HumanovaStore = {
  getState() {
    return normalizeAndBalance(currentState);
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  resetToDemoScenario() {
    currentState = {
      requests: JSON.parse(JSON.stringify(INITIAL_REQUESTS)),
      resources: JSON.parse(JSON.stringify(INITIAL_RESOURCES)),
      volunteers: JSON.parse(JSON.stringify(INITIAL_VOLUNTEERS))
    };
    persistState(currentState);
    notify();
  },

  createRequest(data: {
    title: string;
    description: string;
    category: NeedCategory;
    urgency: UrgencyLevel;
    locationArea: string;
    recipientName: string;
    recipientContact: string;
    quantityNeeded: number;
    resourceName: string;
    unit: string;
  }): CommunityRequest {
    const newId = `req-${Date.now()}`;
    const trackingCode = `HNV-${Math.floor(1000 + Math.random() * 9000)}`;

    // Find or create matching resource in inventory
    let matchedResource = currentState.resources.find(
      (r) =>
        r.name.toLowerCase() === data.resourceName.toLowerCase() ||
        data.resourceName.toLowerCase().includes(r.name.toLowerCase()) ||
        r.name.toLowerCase().includes(data.resourceName.toLowerCase())
    );

    if (!matchedResource) {
      matchedResource = currentState.resources.find((r) => r.category === data.category);
    }

    if (!matchedResource) {
      matchedResource = {
        id: `res-${Date.now()}`,
        name: data.resourceName || 'Emergency Aid Pack',
        category: data.category,
        unit: data.unit || 'units',
        totalAvailable: 0,
        allocated: 0
      };
      currentState.resources.push(matchedResource);
    }

    const resourcesNeeded: ResourceRequirement[] = [
      {
        resourceId: matchedResource.id,
        resourceName: matchedResource.name,
        quantityNeeded: data.quantityNeeded || 1,
        quantityAllocated: 0,
        isSatisfied: false
      }
    ];

    const tasks: ActionTask[] = generateTasksForRequest(
      newId,
      data.category,
      data.locationArea,
      resourcesNeeded
    );

    const newRequest: CommunityRequest = {
      id: newId,
      trackingCode,
      title: data.title,
      description: data.description,
      category: data.category,
      urgency: data.urgency,
      locationArea: data.locationArea,
      recipientName: data.recipientName,
      recipientContact: data.recipientContact,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'open',
      resourcesNeeded,
      tasks
    };

    currentState.requests.unshift(newRequest);

    // Re-evaluate state
    const normalized = normalizeAndBalance(currentState);
    currentState = {
      requests: normalized.requests,
      resources: normalized.resources,
      volunteers: normalized.volunteers
    };
    persistState(currentState);
    notify();

    return currentState.requests.find((r) => r.id === newId) || newRequest;
  },

  replenishResource(resourceId: string, quantityToAdd: number) {
    if (quantityToAdd <= 0) return;

    currentState.resources = currentState.resources.map((res) => {
      if (res.id === resourceId) {
        return {
          ...res,
          totalAvailable: res.totalAvailable + quantityToAdd
        };
      }
      return res;
    });

    const normalized = normalizeAndBalance(currentState);
    currentState = {
      requests: normalized.requests,
      resources: normalized.resources,
      volunteers: normalized.volunteers
    };
    persistState(currentState);
    notify();
  },

  assignTaskVolunteer(taskId: string, volunteerId: string) {
    const volunteer = currentState.volunteers.find((v) => v.id === volunteerId);
    if (!volunteer) return;

    let targetRequestId: string | undefined;

    currentState.requests = currentState.requests.map((req) => {
      const taskIndex = req.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return req;

      targetRequestId = req.id;
      const updatedTasks = [...req.tasks];
      const targetTask = updatedTasks[taskIndex];

      // Update task
      updatedTasks[taskIndex] = {
        ...targetTask,
        assignedVolunteerId: volunteer.id,
        assignedVolunteerName: volunteer.name,
        status: targetTask.status === 'ready' || targetTask.status === 'pending' ? 'ready' : targetTask.status
      };

      return {
        ...req,
        tasks: updatedTasks
      };
    });

    // Update volunteer's active task
    currentState.volunteers = currentState.volunteers.map((v) => {
      if (v.id === volunteerId) {
        return {
          ...v,
          currentAssignedTaskId: taskId
        };
      }
      return v;
    });

    const normalized = normalizeAndBalance(currentState);
    currentState = {
      requests: normalized.requests,
      resources: normalized.resources,
      volunteers: normalized.volunteers
    };
    persistState(currentState);
    notify();
  },

  updateTaskStatus(taskId: string, nextStatus: TaskStatus, notes?: string): { success: boolean; reason?: string } {
    let completedVolunteerId: string | undefined;
    let transitionError: string | undefined;

    currentState.requests = currentState.requests.map((req) => {
      const taskIndex = req.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return req;

      const updatedTasks = [...req.tasks];
      const targetTask = updatedTasks[taskIndex];

      // Rigorous validation via NeedToActionEngine to strictly prevent premature completion
      const validation = NeedToActionEngine.validateTaskTransition(targetTask, nextStatus, req);
      if (!validation.allowed) {
        console.warn('Blocked premature completion/transition:', validation.reason);
        transitionError = validation.reason;
        return req;
      }

      const now = new Date().toISOString();
      const isFinishing = nextStatus === 'completed';
      if (isFinishing && targetTask.assignedVolunteerId) {
        completedVolunteerId = targetTask.assignedVolunteerId;
      }

      updatedTasks[taskIndex] = {
        ...targetTask,
        status: nextStatus,
        startedAt: nextStatus === 'in_progress' && !targetTask.startedAt ? now : targetTask.startedAt,
        completedAt: isFinishing ? now : targetTask.completedAt,
        notes: notes || targetTask.notes
      };

      return {
        ...req,
        tasks: updatedTasks
      };
    });

    // If volunteer completed a task, increment their completed tasks count
    if (completedVolunteerId) {
      currentState.volunteers = currentState.volunteers.map((v) => {
        if (v.id === completedVolunteerId) {
          return {
            ...v,
            completedTasksCount: v.completedTasksCount + 1,
            currentAssignedTaskId: undefined
          };
        }
        return v;
      });
    }

    const normalized = normalizeAndBalance(currentState);
    currentState = {
      requests: normalized.requests,
      resources: normalized.resources,
      volunteers: normalized.volunteers
    };
    persistState(currentState);
    notify();

    if (transitionError) {
      return { success: false, reason: transitionError };
    }
    return { success: true };
  },

  submitRecipientConfirmation(
    requestId: string,
    confirmed: boolean,
    feedback?: string,
    disputeReason?: string
  ) {
    currentState.requests = currentState.requests.map((req) => {
      if (req.id !== requestId) return req;

      const updatedTasks = [...req.tasks];
      // Mark the confirmation task completed if confirmed
      if (confirmed) {
        const confirmTask = updatedTasks.find(
          (t) => t.title.toLowerCase().includes('confirmation') || t.title.toLowerCase().includes('sign-off')
        );
        if (confirmTask) {
          confirmTask.status = 'completed';
          confirmTask.completedAt = new Date().toISOString();
        }
      }

      // When help is confirmed received in full, deduct the physical consumed resources from inventory
      if (confirmed) {
        req.resourcesNeeded.forEach((resReq) => {
          if (resReq.quantityAllocated > 0) {
            currentState.resources = currentState.resources.map((res) => {
              if (res.id === resReq.resourceId) {
                return {
                  ...res,
                  totalAvailable: Math.max(0, res.totalAvailable - resReq.quantityAllocated)
                };
              }
              return res;
            });
          }
        });
      }

      return {
        ...req,
        tasks: updatedTasks,
        recipientConfirmation: {
          confirmed,
          confirmedAt: new Date().toISOString(),
          feedback,
          disputed: !confirmed,
          disputeReason: !confirmed ? disputeReason || 'Recipient indicated service not received' : undefined
        }
      };
    });

    const normalized = normalizeAndBalance(currentState);
    currentState = {
      requests: normalized.requests,
      resources: normalized.resources,
      volunteers: normalized.volunteers
    };
    persistState(currentState);
    notify();
  },

  updateVolunteer(volunteerId: string, updates: Partial<Volunteer>) {
    currentState.volunteers = currentState.volunteers.map((v) =>
      v.id === volunteerId ? { ...v, ...updates } : v
    );
    persistState(currentState);
    notify();
  }
};

/**
 * React Hook for component state synchronization
 */
export function useHumanovaStore() {
  const [data, setData] = useState(() => HumanovaStore.getState());

  useEffect(() => {
    const unsub = HumanovaStore.subscribe(() => {
      setData(HumanovaStore.getState());
    });
    return () => {
      unsub();
    };
  }, []);

  return data;
}
