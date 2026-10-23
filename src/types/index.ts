export type RequestStatus =
  | 'open'
  | 'planned'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'awaiting_confirmation'
  | 'resolved'
  | 'cancelled';

export type TaskStatus =
  | 'pending'
  | 'blocked'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'failed';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export type NeedCategory =
  | 'food_nutrition'
  | 'medical_health'
  | 'elderly_care'
  | 'shelter_clothing'
  | 'transport_logistics'
  | 'emergency_repair';

export interface ResourceItem {
  id: string;
  name: string;
  category: NeedCategory;
  unit: string;
  totalAvailable: number;
  allocated: number; // currently reserved for active requests
  notes?: string;
}

export interface ResourceRequirement {
  resourceId: string;
  resourceName: string;
  quantityNeeded: number;
  quantityAllocated: number;
  isSatisfied: boolean;
}

export type DependencyType =
  | 'TASK_PREREQUISITE'
  | 'RESOURCE_STOCK'
  | 'VOLUNTEER_QUALIFICATION'
  | 'RECIPIENT_CONTACT';

export interface TaskPrerequisite {
  id: string;
  title: string;
  type: DependencyType;
  isSatisfied: boolean;
  details: string;
  unfulfilledReason?: string;
  targetTaskId?: string;
  targetResourceId?: string;
}

export interface BlockerAnalysis {
  isBlocked: boolean;
  blockerType: 'RESOURCE_DEFICIT' | 'PREREQUISITE_TASK' | 'MISSING_DATA' | 'UNASSIGNED_VOLUNTEER' | 'DISPUTED';
  headline: string;
  explanation: string;
  affectedTaskIds: string[];
  remedy: string;
}

export interface NextFeasibleAction {
  role: 'coordinator' | 'volunteer' | 'seeker';
  actionTitle: string;
  description: string;
  impact: string;
  targetTaskId?: string;
  targetResourceId?: string;
  actionType: 'replenish_resource' | 'assign_volunteer' | 'start_task' | 'complete_task' | 'confirm_receipt';
}

export interface ActionTask {
  id: string;
  requestId: string;
  title: string;
  description: string;
  requiredSkills: string[];
  estimatedMinutes: number;
  dependsOnTaskIds: string[]; // List of task IDs that MUST be completed before this can start
  requiredResourceId?: string;
  requiredResourceQuantity?: number;
  status: TaskStatus;
  blockedReason?: string;
  prerequisites?: TaskPrerequisite[]; // Detailed prerequisite breakdown
  blockerAnalysis?: BlockerAnalysis;
  assignedVolunteerId?: string;
  assignedVolunteerName?: string;
  startedAt?: string;
  completedAt?: string;
  order: number;
  notes?: string;
}

export interface RecipientConfirmation {
  confirmed: boolean;
  confirmedAt?: string;
  rating?: number;
  feedback?: string;
  disputed?: boolean;
  disputeReason?: string;
}

export interface CommunityRequest {
  id: string;
  trackingCode: string;
  title: string;
  description: string;
  category: NeedCategory;
  urgency: UrgencyLevel;
  locationArea: string; // e.g. "Downtown District", "North Hills", "West End"
  recipientName: string;
  recipientContact: string;
  createdAt: string;
  updatedAt: string;
  status: RequestStatus;
  resourcesNeeded: ResourceRequirement[];
  tasks: ActionTask[];
  blockedReason?: string;
  nextActionableStep?: string;
  blockerAnalysis?: BlockerAnalysis; // Comprehensive diagnosis of what is preventing resolution
  nextFeasibleAction?: NextFeasibleAction; // Structured recommendation for next actionable step
  recipientConfirmation?: RecipientConfirmation;
  isDemoSample?: boolean;
}

export interface Volunteer {
  id: string;
  name: string;
  avatar: string;
  email: string;
  phone: string;
  skills: string[];
  serviceAreas: string[];
  availabilityStatus: 'available' | 'busy' | 'offline';
  hoursPerWeek: number;
  timeSlots: string[]; // e.g. ["Morning", "Afternoon", "Evening", "Weekends"]
  rating: number;
  completedTasksCount: number;
  currentAssignedTaskId?: string;
  verified: boolean;
}

export interface VolunteerMatch {
  volunteer: Volunteer;
  matchScore: number; // 0 - 100
  breakdown: {
    skillScore: number;
    areaScore: number;
    availabilityScore: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string;
  isEligible: boolean;
}

export interface ParsedNeedIntake {
  title: string;
  category: NeedCategory;
  urgency: UrgencyLevel;
  quantityNeeded: number;
  resourceName: string;
  resourceCategory: NeedCategory;
  unit: string;
  locationArea: string;
  identifiedSkills: string[];
  missingInformation: string[];
  confidence: number;
}
