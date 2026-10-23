import { CommunityRequest, ResourceItem, Volunteer } from '../types';

export const INITIAL_RESOURCES: ResourceItem[] = [
  {
    id: 'res-meals',
    name: 'Prepared Nutritious Meals',
    category: 'food_nutrition',
    unit: 'meals',
    totalAvailable: 12, // Exactly 12 available meals per Hackathon Demo spec
    allocated: 12,      // 12 allocated to Request 1, leaving 0 for Request 2 (Needs 8 -> Deficit 8)
    notes: 'Stored in Community Pantry Walk-In Cooler'
  },
  {
    id: 'res-meds',
    name: 'Prescription Medical Kits',
    category: 'medical_health',
    unit: 'kits',
    totalAvailable: 5,
    allocated: 1,
    notes: 'Secured in Central Health Hub'
  },
  {
    id: 'res-tarps',
    name: 'Heavy-Duty Weather Tarps',
    category: 'emergency_repair',
    unit: 'units',
    totalAvailable: 4,
    allocated: 1,
    notes: 'Community Warehouse Bay 3'
  },
  {
    id: 'res-water',
    name: 'Clean Bottled Water Packs',
    category: 'food_nutrition',
    unit: 'packs',
    totalAvailable: 20,
    allocated: 0,
    notes: '24-bottle shrink-wrapped packs'
  }
];

export const INITIAL_VOLUNTEERS: Volunteer[] = [
  {
    id: 'vol-1',
    name: 'Elena Rostova',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    email: 'elena.rostova@community.org',
    phone: '+1 (555) 234-8901',
    skills: ['Food Handling', 'Vehicle Delivery', 'Inventory Packing'],
    serviceAreas: ['Downtown District', 'Eastside Ward'],
    availabilityStatus: 'available',
    hoursPerWeek: 15,
    timeSlots: ['Morning', 'Afternoon'],
    rating: 4.95,
    completedTasksCount: 38,
    verified: true
  },
  {
    id: 'vol-2',
    name: 'Marcus Chen, RN',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    email: 'marcus.chen@medvolunteers.org',
    phone: '+1 (555) 782-9012',
    skills: ['First Aid & Medical', 'Prescription Handling', 'Elderly Care', 'Bilingual (Spanish)'],
    serviceAreas: ['Downtown District', 'North Hills'],
    availabilityStatus: 'available',
    hoursPerWeek: 10,
    timeSlots: ['Afternoon', 'Evening'],
    rating: 4.98,
    completedTasksCount: 52,
    verified: true
  },
  {
    id: 'vol-3',
    name: 'Amina Diallo',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80',
    email: 'amina.diallo@aidnetwork.org',
    phone: '+1 (555) 456-7890',
    skills: ['Elderly Care', 'Social Work', 'Food Handling'],
    serviceAreas: ['North Hills', 'West End'],
    availabilityStatus: 'available',
    hoursPerWeek: 12,
    timeSlots: ['Morning', 'Evening', 'Weekends'],
    rating: 4.88,
    completedTasksCount: 24,
    verified: true
  },
  {
    id: 'vol-4',
    name: 'David Miller',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80',
    email: 'david.miller@builderrescue.org',
    phone: '+1 (555) 678-1234',
    skills: ['Emergency Repair', 'Carpentry & Tools', 'Heavy Lifting', 'Vehicle Delivery'],
    serviceAreas: ['Downtown District', 'Eastside Ward', 'West End'],
    availabilityStatus: 'available',
    hoursPerWeek: 20,
    timeSlots: ['Weekends', 'Morning', 'Afternoon'],
    rating: 4.92,
    completedTasksCount: 41,
    verified: true
  },
  {
    id: 'vol-5',
    name: 'Maya Lin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    email: 'maya.lin@cityaid.org',
    phone: '+1 (555) 890-4321',
    skills: ['Inventory Packing', 'Bicycle Courier', 'Light Logistics'],
    serviceAreas: ['Downtown District'],
    availabilityStatus: 'busy',
    hoursPerWeek: 8,
    timeSlots: ['Evening'],
    rating: 4.75,
    completedTasksCount: 19,
    currentAssignedTaskId: 't-pre-existing',
    verified: true
  }
];

export const INITIAL_REQUESTS: CommunityRequest[] = [
  {
    id: 'req-elderly-lunch',
    trackingCode: 'HNV-2041',
    title: 'Senior Living Center Emergency Lunch Relief',
    description: '12 low-income seniors at Pineview Heights require nutritious cooked dietary lunch boxes after kitchen refrigeration system failure.',
    category: 'food_nutrition',
    urgency: 'high',
    locationArea: 'Downtown District',
    recipientName: 'Pineview Senior Center (Attn: Walter Vance)',
    recipientContact: 'walter.v@pineview.org | 555-019-2831',
    createdAt: '2026-10-23T06:30:00Z',
    updatedAt: '2026-10-23T07:15:00Z',
    status: 'assigned',
    resourcesNeeded: [
      {
        resourceId: 'res-meals',
        resourceName: 'Prepared Nutritious Meals',
        quantityNeeded: 12,
        quantityAllocated: 12,
        isSatisfied: true
      }
    ],
    tasks: [
      {
        id: 'task-el-1',
        requestId: 'req-elderly-lunch',
        order: 1,
        title: 'Inspect & Pack 12 Senior Dietary Meal Kits',
        description: 'Verify allergen tags and package 12 thermal meal containers from pantry cooler into insulated crates.',
        requiredSkills: ['Food Handling', 'Inventory Packing'],
        estimatedMinutes: 25,
        dependsOnTaskIds: [], // Root task
        requiredResourceId: 'res-meals',
        requiredResourceQuantity: 12,
        status: 'completed',
        assignedVolunteerId: 'vol-1',
        assignedVolunteerName: 'Elena Rostova',
        startedAt: '2026-10-23T07:00:00Z',
        completedAt: '2026-10-23T07:25:00Z'
      },
      {
        id: 'task-el-2',
        requestId: 'req-elderly-lunch',
        order: 2,
        title: 'Thermal Transport to Pineview Heights (Downtown)',
        description: 'Drive insulated crates to Pineview Senior Center reception. Maintain food safe transit temp.',
        requiredSkills: ['Vehicle Delivery', 'Food Handling'],
        estimatedMinutes: 30,
        dependsOnTaskIds: ['task-el-1'], // Depends on packaging completion
        status: 'ready',
        assignedVolunteerId: 'vol-1',
        assignedVolunteerName: 'Elena Rostova'
      },
      {
        id: 'task-el-3',
        requestId: 'req-elderly-lunch',
        order: 3,
        title: 'Direct Recipient Handoff & Quality Check',
        description: 'Transfer meal crates to Walter Vance and record delivery signature.',
        requiredSkills: ['Food Handling'],
        estimatedMinutes: 15,
        dependsOnTaskIds: ['task-el-2'], // Blocked until delivery arrives
        status: 'blocked',
        blockedReason: 'Prerequisite Task "Thermal Transport to Pineview Heights" must complete first.'
      },
      {
        id: 'task-el-4',
        requestId: 'req-elderly-lunch',
        order: 4,
        title: 'Recipient Confirmation & Dietary Feedback',
        description: 'Senior center coordinator records digital receipt and logs meal temperature acceptance.',
        requiredSkills: [],
        estimatedMinutes: 10,
        dependsOnTaskIds: ['task-el-3'],
        status: 'blocked',
        blockedReason: 'Pending physical handoff.'
      }
    ],
    nextActionableStep: 'Elena Rostova to initiate thermal transport (Task 2)',
    isDemoSample: true
  },
  {
    id: 'req-family-shelter',
    trackingCode: 'HNV-2042',
    title: 'Eastside Family Shelter Evening Dinner Support',
    description: '8 displaced family members (including 3 children) in temporary shelter require 8 balanced warm evening meals.',
    category: 'food_nutrition',
    urgency: 'high',
    locationArea: 'Eastside Ward',
    recipientName: 'Hope Haven Shelter (Sister Maria Gomez)',
    recipientContact: 'maria.g@hopehaven.org | 555-442-1980',
    createdAt: '2026-10-23T07:00:00Z',
    updatedAt: '2026-10-23T07:00:00Z',
    status: 'blocked',
    resourcesNeeded: [
      {
        resourceId: 'res-meals',
        resourceName: 'Prepared Nutritious Meals',
        quantityNeeded: 8,
        quantityAllocated: 0,
        isSatisfied: false
      }
    ],
    tasks: [
      {
        id: 'task-fs-1',
        requestId: 'req-family-shelter',
        order: 1,
        title: 'Allocate & Pack 8 Family Dinner Portions',
        description: 'Secure 8 prepared meals from inventory and pack child-friendly portions with milk/fruit.',
        requiredSkills: ['Food Handling', 'Inventory Packing'],
        estimatedMinutes: 20,
        dependsOnTaskIds: [],
        requiredResourceId: 'res-meals',
        requiredResourceQuantity: 8,
        status: 'blocked',
        blockedReason: 'CRITICAL RESOURCE SHORTAGE: 8 Prepared Nutritious Meals needed, but inventory has 0 unallocated units. (Total community meal demand: 20, Stock: 12).'
      },
      {
        id: 'task-fs-2',
        requestId: 'req-family-shelter',
        order: 2,
        title: 'Transit Courier to Eastside Shelter',
        description: 'Transport dinner packages to Hope Haven reception on 14th Avenue.',
        requiredSkills: ['Vehicle Delivery'],
        estimatedMinutes: 25,
        dependsOnTaskIds: ['task-fs-1'],
        status: 'blocked',
        blockedReason: 'Blocked until meal supply is replenished and packed.'
      },
      {
        id: 'task-fs-3',
        requestId: 'req-family-shelter',
        order: 3,
        title: 'Shelter Recipient Receipt Confirmation',
        description: 'Confirm intake with Sister Maria and log confirmation code.',
        requiredSkills: [],
        estimatedMinutes: 10,
        dependsOnTaskIds: ['task-fs-2'],
        status: 'blocked',
        blockedReason: 'Blocked by preceding delivery task.'
      }
    ],
    blockedReason: 'Inventory Shortage: 8 Prepared Meals deficit (20 requested community-wide vs 12 in stock). Coordinator must record supply replenishment.',
    nextActionableStep: 'Community Coordinator to record inbound meal donation of ≥8 units to unblock task #1.',
    isDemoSample: true
  },
  {
    id: 'req-med-courier',
    trackingCode: 'HNV-2043',
    title: 'Essential Blood Pressure Medication & Vitals Check',
    description: 'Elderly resident recovering from hip surgery needs urgent hypertension prescription retrieved from pharmacy and delivered with blood pressure cuff check.',
    category: 'medical_health',
    urgency: 'critical',
    locationArea: 'Downtown District',
    recipientName: 'Evelyn Scott (Age 79)',
    recipientContact: 'evelyn.s79@localmail.net | 555-891-2309',
    createdAt: '2026-10-23T06:45:00Z',
    updatedAt: '2026-10-23T07:10:00Z',
    status: 'assigned',
    resourcesNeeded: [
      {
        resourceId: 'res-meds',
        resourceName: 'Prescription Medical Kits',
        quantityNeeded: 1,
        quantityAllocated: 1,
        isSatisfied: true
      }
    ],
    tasks: [
      {
        id: 'task-med-1',
        requestId: 'req-med-courier',
        order: 1,
        title: 'Collect Rx from Metro Pharmacy',
        description: 'Present authorization code #MED-771 at 4th St Pharmacy for prescription pick-up.',
        requiredSkills: ['Prescription Handling', 'First Aid & Medical'],
        estimatedMinutes: 25,
        dependsOnTaskIds: [],
        requiredResourceId: 'res-meds',
        requiredResourceQuantity: 1,
        status: 'completed',
        assignedVolunteerId: 'vol-2',
        assignedVolunteerName: 'Marcus Chen, RN',
        startedAt: '2026-10-23T06:55:00Z',
        completedAt: '2026-10-23T07:18:00Z'
      },
      {
        id: 'task-med-2',
        requestId: 'req-med-courier',
        order: 2,
        title: 'In-Person Delivery & Non-Invasive Vitals Check',
        description: 'Deliver medicine to Apt 4B. Perform standard BP check and provide water.',
        requiredSkills: ['First Aid & Medical', 'Elderly Care'],
        estimatedMinutes: 25,
        dependsOnTaskIds: ['task-med-1'],
        status: 'in_progress',
        assignedVolunteerId: 'vol-2',
        assignedVolunteerName: 'Marcus Chen, RN',
        startedAt: '2026-10-23T07:20:00Z'
      },
      {
        id: 'task-med-3',
        requestId: 'req-med-courier',
        order: 3,
        title: 'Recipient Confirmation & Safety Sign-off',
        description: 'Evelyn or designated caregiver confirms safe medication delivery.',
        requiredSkills: [],
        estimatedMinutes: 5,
        dependsOnTaskIds: ['task-med-2'],
        status: 'blocked',
        blockedReason: 'Pending completion of in-person vitals check.'
      }
    ],
    nextActionableStep: 'Marcus Chen completing in-person delivery & vitals check',
    isDemoSample: true
  }
];
