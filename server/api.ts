import { randomBytes, randomInt } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { Prisma, TaskStatus as DbTaskStatus } from '@prisma/client';
import { z, ZodType } from 'zod';
import { NeedToActionEngine, evaluateRequestState, findTaskDependencyIssues } from '../src/services/plannerEngine';
import { rankVolunteersForTask } from '../src/services/volunteerMatcher';
import { ActionTask, CommunityRequest, NeedCategory, ResourceItem, TaskStatus, UrgencyLevel, Volunteer } from '../src/types';
import { prisma } from './db';
import { seedDatabase } from './seed';
import { INITIAL_RESOURCES, INITIAL_VOLUNTEERS } from '../src/data/seedData';
import {
  confirmationSchema,
  requestCreateSchema,
  resourceCreateSchema,
  resourceUpdateSchema,
  quantitySchema,
  taskCreateSchema,
  taskStatusUpdateSchema,
  volunteerCreateSchema,
  volunteerUpdateSchema
} from './validation';

const router = Router();
const publicWriteLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
const requestInclude = {
  resourcesNeeded: { include: { resource: true, allocations: true } },
  tasks: {
    include: {
      dependencies: { include: { prerequisiteTask: true } },
      prerequisites: true,
      assignments: { where: { status: 'ACTIVE' }, include: { volunteer: { include: { user: true } } } }
    },
    orderBy: { order: 'asc' }
  },
  outcomeConfirmation: true
} satisfies Prisma.CommunityRequestInclude;

type IncludedRequest = Prisma.CommunityRequestGetPayload<{ include: typeof requestInclude }>;
type DbTransaction = Prisma.TransactionClient;
const volunteerInclude = {
  user: true,
  skills: true,
  serviceAreas: true,
  assignments: { where: { status: 'ACTIVE' } }
} satisfies Prisma.VolunteerProfileInclude;
type IncludedVolunteer = Prisma.VolunteerProfileGetPayload<{ include: typeof volunteerInclude }>;

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.', result.error.issues);
  return result.data;
}

function enumToDb(value: string) {
  return value.toUpperCase() as never;
}

function enumToUi<T extends string>(value: string): T {
  return value.toLowerCase() as T;
}

function newId() {
  return randomBytes(12).toString('hex');
}

function serializeResource(resource: { id: string; name: string; category: string; unit: string; totalAvailable: number; allocated: number; notes: string | null }): ResourceItem {
  return {
    id: resource.id,
    name: resource.name,
    category: enumToUi<NeedCategory>(resource.category),
    unit: resource.unit,
    totalAvailable: resource.totalAvailable,
    allocated: resource.allocated,
    notes: resource.notes || undefined
  };
}

function serializeVolunteer(profile: IncludedVolunteer): Volunteer {
  return {
    id: profile.userId,
    name: profile.user.name,
    email: profile.user.email || '',
    phone: profile.phone || '',
    avatar: profile.avatar || '',
    skills: profile.skills.map((skill) => skill.skill),
    serviceAreas: profile.serviceAreas.map((area) => area.area),
    availabilityStatus: enumToUi(profile.availabilityStatus) as Volunteer['availabilityStatus'],
    hoursPerWeek: profile.hoursPerWeek,
    timeSlots: profile.timeSlots,
    rating: profile.rating,
    completedTasksCount: profile.completedTasksCount,
    currentAssignedTaskId: profile.assignments[0]?.taskId,
    verified: profile.verified
  };
}

function missingPrerequisiteReason(prerequisite: IncludedRequest['tasks'][number]['prerequisites'][number], request: IncludedRequest) {
  if (prerequisite.type === 'TASK_PREREQUISITE') {
    const target = request.tasks.find((task) => task.id === prerequisite.targetTaskId);
    return target?.status === 'COMPLETED' ? undefined : target ? `Step ${target.order} has not completed yet.` : 'Prerequisite task is missing.';
  }
  if (prerequisite.type === 'RESOURCE_STOCK') {
    const resource = request.resourcesNeeded.find((item) => item.resourceId === prerequisite.targetResourceId);
    const task = request.tasks.find((item) => item.id === prerequisite.taskId);
    const required = resource && task?.requiredResourceId === resource.resourceId
      ? task.requiredResourceQuantity ?? resource.quantityNeeded
      : resource?.quantityNeeded ?? 0;
    const allocated = resource?.allocations
      .filter((allocation) => allocation.status === 'ACTIVE' || allocation.status === 'CONSUMED')
      .reduce((sum, allocation) => sum + allocation.quantity, 0) ?? 0;
    return resource && allocated >= required ? undefined : resource ? `Resource shortage: ${Math.max(0, required - allocated)} ${resource.resource.name} missing from inventory.` : 'Required resource is not tracked.';
  }
  if (prerequisite.type === 'VOLUNTEER_QUALIFICATION') {
    const assigned = request.tasks.find((task) => task.id === prerequisite.taskId)?.assignments.length;
    return assigned ? undefined : 'No volunteer assigned yet.';
  }
  return undefined;
}

function serializeRequest(request: IncludedRequest): CommunityRequest {
  const resourcesNeeded = request.resourcesNeeded.map((requirement) => {
    const quantityAllocated = requirement.allocations
      .filter((allocation) => allocation.status === 'ACTIVE' || allocation.status === 'CONSUMED')
      .reduce((sum, allocation) => sum + allocation.quantity, 0);
    return {
      resourceId: requirement.resourceId,
      resourceName: requirement.resource.name,
      quantityNeeded: requirement.quantityNeeded,
      quantityAllocated,
      isSatisfied: quantityAllocated >= requirement.quantityNeeded
    };
  });

  const tasks: ActionTask[] = request.tasks.map((task) => {
    const assignment = task.assignments[0];
    return {
      id: task.id,
      requestId: task.requestId,
      order: task.order,
      title: task.title,
      description: task.description,
      requiredSkills: task.requiredSkills,
      estimatedMinutes: task.estimatedMinutes,
      dependsOnTaskIds: task.dependencies.map((dependency) => dependency.prerequisiteTaskId),
      requiredResourceId: task.requiredResourceId || undefined,
      requiredResourceQuantity: task.requiredResourceQuantity || undefined,
      status: enumToUi<TaskStatus>(task.status),
      blockedReason: task.blockedReason || undefined,
      assignedVolunteerId: assignment?.volunteerId,
      assignedVolunteerName: assignment?.volunteer.user.name,
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      notes: task.notes || undefined,
      prerequisites: task.prerequisites.map((prerequisite) => {
        const unfulfilledReason = missingPrerequisiteReason(prerequisite, request);
        return {
          id: prerequisite.id,
          title: prerequisite.title,
          type: enumToUi(prerequisite.type) as NonNullable<ActionTask['prerequisites']>[number]['type'],
          details: prerequisite.details,
          isSatisfied: !unfulfilledReason,
          unfulfilledReason,
          targetTaskId: prerequisite.targetTaskId || undefined,
          targetResourceId: prerequisite.targetResourceId || undefined
        };
      })
    };
  });

  const confirmation = request.outcomeConfirmation;
  const serialized: CommunityRequest = {
    id: request.id,
    trackingCode: request.trackingCode,
    title: request.title,
    description: request.description,
    category: enumToUi<NeedCategory>(request.category),
    urgency: enumToUi<UrgencyLevel>(request.urgency),
    locationArea: request.locationArea,
    recipientName: request.recipientName,
    recipientContact: request.recipientContact,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    status: enumToUi(request.status) as CommunityRequest['status'],
    resourcesNeeded,
    tasks,
    blockedReason: tasks.find((task) => task.status === 'blocked')?.blockedReason,
    nextActionableStep: tasks.find((task) => task.status === 'ready')?.title,
    recipientConfirmation: confirmation ? {
      confirmed: confirmation.confirmed,
      confirmedAt: confirmation.confirmedAt.toISOString(),
      feedback: confirmation.feedback || undefined,
      disputed: confirmation.disputed,
      disputeReason: confirmation.disputeReason || undefined
    } : undefined,
    isDemoSample: request.isDemoSample
  };
  const derived = evaluateRequestState(serialized);
  return {
    ...serialized,
    tasks: serialized.tasks.map((task, index) => ({ ...task, prerequisites: derived.tasks[index]?.prerequisites })),
    blockedReason: derived.blockedReason,
    nextActionableStep: derived.nextActionableStep,
    blockerAnalysis: derived.blockerAnalysis,
    nextFeasibleAction: derived.nextFeasibleAction
  };
}

export function validateTaskGraph(tasks: Array<{ id: string; requestId: string; dependsOnTaskIds: string[]; requiredSkills: string[]; estimatedMinutes: number; title: string; description: string; status: TaskStatus; order: number }>) {
  const taskIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    const invalid = task.dependsOnTaskIds.find((dependencyId) => !taskIds.has(dependencyId) || dependencyId === task.id);
    if (invalid) throw new ApiError(400, 'INVALID_DEPENDENCY', `Task ${task.title} has an invalid dependency reference.`);
  }
  const issues = findTaskDependencyIssues(tasks as ActionTask[]);
  if (issues.size > 0) throw new ApiError(400, 'DEPENDENCY_CYCLE', 'Task plan contains a circular or invalid dependency.', [...issues.values()]);
}

export async function reallocateResource(tx: DbTransaction, resourceId: string) {
  const resource = await tx.resource.findUnique({ where: { id: resourceId } });
  if (!resource) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Resource was not found.');

  const requirements = await tx.resourceRequirement.findMany({
    where: { resourceId, request: { status: { notIn: ['RESOLVED', 'CANCELLED'] } } },
    include: { request: true },
    orderBy: { request: { createdAt: 'asc' } }
  });
  const urgency: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  requirements.sort((left, right) => {
    const priority = urgency[right.request.urgency] - urgency[left.request.urgency];
    return priority || left.request.createdAt.getTime() - right.request.createdAt.getTime();
  });

  await tx.resourceAllocation.updateMany({ where: { requirementId: { in: requirements.map((item) => item.id) }, status: 'ACTIVE' }, data: { status: 'RELEASED', releasedAt: new Date() } });
  let remaining = resource.totalAvailable;
  let allocatedTotal = 0;
  for (const requirement of requirements) {
    const quantity = Math.min(remaining, requirement.quantityNeeded);
    if (quantity > 0) {
      await tx.resourceAllocation.create({ data: { requirementId: requirement.id, quantity, status: 'ACTIVE' } });
      remaining -= quantity;
      allocatedTotal += quantity;
    }
  }
  await tx.resource.update({ where: { id: resourceId }, data: { allocated: allocatedTotal } });
}

export async function reevaluateRequest(tx: DbTransaction, requestId: string) {
  const request = await tx.communityRequest.findUnique({
    where: { id: requestId },
    include: {
      tasks: { include: { dependencies: true, prerequisites: true }, orderBy: { order: 'asc' } },
      resourcesNeeded: { include: { allocations: { where: { status: 'ACTIVE' } } } }
    }
  });
  if (!request) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Community request was not found.');

  const taskIds = new Set(request.tasks.map((task) => task.id));
  const graphTasks = request.tasks.map((task) => ({
    id: task.id,
    requestId: task.requestId,
    title: task.title,
    description: task.description,
    requiredSkills: task.requiredSkills,
    estimatedMinutes: task.estimatedMinutes,
    dependsOnTaskIds: [...new Set([
      ...task.dependencies.map((dependency) => dependency.prerequisiteTaskId),
      ...task.prerequisites.filter((prerequisite) => prerequisite.type === 'TASK_PREREQUISITE' && prerequisite.targetTaskId).map((prerequisite) => prerequisite.targetTaskId as string)
    ])],
    status: enumToUi<TaskStatus>(task.status),
    order: task.order
  } as ActionTask));
  const issues = findTaskDependencyIssues(graphTasks);

  for (const task of request.tasks) {
    if (task.status === 'COMPLETED' || task.status === 'FAILED') continue;
    const dependencyIds = graphTasks.find((candidate) => candidate.id === task.id)?.dependsOnTaskIds || [];
    const missingDependency = dependencyIds.find((dependencyId) => !taskIds.has(dependencyId));
    const dependencyIssue = issues.get(task.id);
    const malformedPrerequisite = task.prerequisites.find((prerequisite) =>
      prerequisite.type === 'TASK_PREREQUISITE' && (!prerequisite.targetTaskId || !taskIds.has(prerequisite.targetTaskId))
    );
    if (missingDependency || dependencyIssue || malformedPrerequisite) {
      await tx.actionTask.update({ where: { id: task.id }, data: { status: 'BLOCKED', blockedReason: dependencyIssue || 'Prerequisite task is missing.' } });
      continue;
    }
    const uncompleted = request.tasks.find((candidate) => dependencyIds.includes(candidate.id) && candidate.status !== 'COMPLETED');
    if (uncompleted) {
      await tx.actionTask.update({ where: { id: task.id }, data: { status: 'BLOCKED', blockedReason: `Waiting on prerequisite task: "${uncompleted.title}".` } });
      continue;
    }
    const resourcePrerequisites = task.prerequisites.filter((prerequisite) => prerequisite.type === 'RESOURCE_STOCK');
    const requiredResources = new Set([
      ...(task.requiredResourceId ? [task.requiredResourceId] : []),
      ...resourcePrerequisites.map((prerequisite) => prerequisite.targetResourceId || task.requiredResourceId).filter((id): id is string => Boolean(id))
    ]);
    if (resourcePrerequisites.some((prerequisite) => !prerequisite.targetResourceId && !task.requiredResourceId)) {
      await tx.actionTask.update({ where: { id: task.id }, data: { status: 'BLOCKED', blockedReason: 'Resource prerequisite is missing its inventory reference.' } });
      continue;
    }
    let resourceBlocker: string | undefined;
    for (const resourceId of requiredResources) {
      const requirement = request.resourcesNeeded.find((item) => item.resourceId === resourceId);
      const allocated = requirement?.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0) || 0;
      const required = resourceId === task.requiredResourceId
        ? task.requiredResourceQuantity || requirement?.quantityNeeded || 0
        : requirement?.quantityNeeded || 0;
      if (!requirement || allocated < required) {
        const name = requirement?.resourceId || resourceId;
        resourceBlocker = `Resource shortage: ${Math.max(0, required - allocated)} ${name} missing from inventory.`;
        break;
      }
    }
    if (resourceBlocker) {
      await tx.actionTask.update({ where: { id: task.id }, data: { status: 'BLOCKED', blockedReason: resourceBlocker } });
      continue;
    }
    if (task.status !== 'IN_PROGRESS') {
      await tx.actionTask.update({ where: { id: task.id }, data: { status: 'READY', blockedReason: null } });
    }
  }

  const refreshed = await tx.actionTask.findMany({ where: { requestId }, include: { assignments: { where: { status: 'ACTIVE' } } }, orderBy: { order: 'asc' } });
  const activeTasks = refreshed.filter((task) => !task.title.toLowerCase().includes('confirmation') && !task.title.toLowerCase().includes('sign-off'));
  const allDone = activeTasks.length > 0 && activeTasks.every((task) => task.status === 'COMPLETED');
  const hasShortage = request.resourcesNeeded.some((requirement) => {
    const allocated = requirement.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
    return allocated < requirement.quantityNeeded;
  });
  const nextStatus = allDone ? 'AWAITING_CONFIRMATION' : hasShortage ? 'BLOCKED' : refreshed.some((task) => task.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : refreshed.some((task) => task.status === 'READY') ? (refreshed.some((task) => task.status === 'READY' && task.assignments?.length) ? 'ASSIGNED' : 'PLANNED') : 'BLOCKED';
  await tx.communityRequest.update({ where: { id: requestId }, data: { status: nextStatus } });
}

async function refreshResourceRequests(tx: DbTransaction, resourceId: string) {
  const requestIds = await tx.resourceRequirement.findMany({ where: { resourceId }, select: { requestId: true } });
  for (const item of requestIds) await reevaluateRequest(tx, item.requestId);
}

function createTaskPlan(data: { requestId: string; category: NeedCategory; locationArea: string; resources: Array<{ id: string; name: string; quantityNeeded: number }> }) {
  const requirements = data.resources.map((resource) => ({
    resourceId: resource.id,
    resourceName: resource.name,
    quantityNeeded: resource.quantityNeeded,
    quantityAllocated: 0,
    isSatisfied: false
  }));
  return NeedToActionEngine.convertNeedToTasks(data.requestId, data.category, data.locationArea, requirements);
}

router.get('/health', asyncRoute(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ success: true, data: { database: 'connected' } });
}));

router.post('/demo/reset', asyncRoute(async (_req, res) => {
  await seedDatabase();
  const resourceIds = INITIAL_RESOURCES.map((resource) => resource.id);
  const volunteerIds = INITIAL_VOLUNTEERS.map((volunteer) => volunteer.id);
  const [realRequirements, assignmentHistory] = await Promise.all([
    prisma.resourceRequirement.count({ where: { resourceId: { in: resourceIds }, request: { isDemoSample: false } } }),
    prisma.volunteerAssignment.count({ where: { volunteerId: { in: volunteerIds } } })
  ]);
  if (realRequirements || assignmentHistory) {
    throw new ApiError(409, 'SAMPLE_DATA_IN_USE', 'Sample inventory or volunteer profiles are linked to saved work and cannot be reset safely.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.communityRequest.deleteMany({ where: { isDemoSample: true } });
    for (const resource of INITIAL_RESOURCES) {
      await tx.resource.update({ where: { id: resource.id }, data: {
        totalAvailable: resource.totalAvailable,
        allocated: 0,
        notes: 'Humanova sample inventory'
      } });
    }
    for (const volunteer of INITIAL_VOLUNTEERS) {
      await tx.volunteerProfile.update({ where: { userId: volunteer.id }, data: {
        availabilityStatus: 'AVAILABLE',
        hoursPerWeek: volunteer.hoursPerWeek,
        timeSlots: volunteer.timeSlots,
        rating: 0,
        completedTasksCount: 0,
        verified: volunteer.verified
      } });
      await tx.volunteerSkill.deleteMany({ where: { volunteerId: volunteer.id } });
      await tx.volunteerServiceArea.deleteMany({ where: { volunteerId: volunteer.id } });
      await tx.volunteerSkill.createMany({ data: volunteer.skills.map((skill) => ({ volunteerId: volunteer.id, skill, verified: volunteer.verified })) });
      await tx.volunteerServiceArea.createMany({ data: volunteer.serviceAreas.map((area) => ({ volunteerId: volunteer.id, area })) });
    }
  });
  await seedDatabase();
  res.json({ success: true, data: { reset: true, requestsRemoved: 'demo samples only' } });
}));

router.get('/state', asyncRoute(async (_req, res) => {
  const [dbRequests, dbResources, dbVolunteers] = await Promise.all([
    prisma.communityRequest.findMany({ include: requestInclude, orderBy: { createdAt: 'desc' } }),
    prisma.resource.findMany({ orderBy: { name: 'asc' } }),
    prisma.volunteerProfile.findMany({ include: { user: true, skills: true, serviceAreas: true, assignments: { where: { status: 'ACTIVE' } } }, orderBy: { createdAt: 'asc' } })
  ]);
  const requests = dbRequests.map(serializeRequest);
  const resources = dbResources.map(serializeResource);
  const volunteers = dbVolunteers.map(serializeVolunteer);
  const resourcesSummary = resources.map((resource) => {
    const affectedRequests = requests.flatMap((request) => request.resourcesNeeded
      .filter((requirement) => requirement.resourceId === resource.id && !requirement.isSatisfied)
      .map((requirement) => ({
        id: request.id,
        trackingCode: request.trackingCode,
        title: request.title,
        quantityNeeded: requirement.quantityNeeded,
        quantityAllocated: requirement.quantityAllocated,
        shortfall: requirement.quantityNeeded - requirement.quantityAllocated
      })));
    const totalRequested = requests.filter((request) => request.status !== 'resolved' && request.status !== 'cancelled')
      .flatMap((request) => request.resourcesNeeded).filter((requirement) => requirement.resourceId === resource.id)
      .reduce((sum, requirement) => sum + requirement.quantityNeeded, 0);
    const shortageDeficit = Math.max(0, totalRequested - resource.totalAvailable);
    return { resource, totalRequested, totalAllocated: resource.allocated, availableStock: Math.max(0, resource.totalAvailable - resource.allocated), shortageDeficit, hasShortage: shortageDeficit > 0, affectedRequestCount: affectedRequests.length, affectedRequests };
  });
  res.json({ success: true, data: {
    requests, resources, volunteers,
    metrics: {
      totalRequests: requests.length,
      activeRequests: requests.filter((request) => request.status !== 'resolved' && request.status !== 'cancelled').length,
      blockedRequestsCount: requests.filter((request) => request.status === 'blocked').length,
      awaitingConfirmationCount: requests.filter((request) => request.status === 'awaiting_confirmation').length,
      resolvedRequestsCount: requests.filter((request) => request.status === 'resolved').length,
      criticalShortageCount: resourcesSummary.filter((summary) => summary.hasShortage).length,
      resourcesSummary
    }
  } });
}));

router.get('/requests', asyncRoute(async (_req, res) => {
  const requests = await prisma.communityRequest.findMany({ include: requestInclude, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: requests.map(serializeRequest) });
}));

router.post('/requests', publicWriteLimit, asyncRoute(async (req, res) => {
  const data = parseBody(requestCreateSchema, req.body);
  const requestedTasks = data.tasks || [];
  const trackingCode = `HNV-${randomInt(1000, 10000)}`;
  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.communityRequest.create({ data: {
      trackingCode,
      title: data.title,
      description: data.description,
      category: enumToDb(data.category),
      urgency: enumToDb(data.urgency || 'medium'),
      locationArea: data.locationArea,
      recipientName: data.recipientName,
      recipientContact: data.recipientContact,
      status: 'OPEN'
    } });

    const resources: Array<{ id: string; name: string; quantityNeeded: number }> = [];
    for (const requirement of data.resourcesNeeded) {
      let resource;
      if (requirement.resourceId) {
        resource = await tx.resource.findUnique({ where: { id: requirement.resourceId } });
        if (!resource) throw new ApiError(400, 'RESOURCE_NOT_FOUND', 'A requested inventory resource does not exist.');
      } else {
        resource = await tx.resource.upsert({
          where: { name_unit: { name: requirement.resourceName, unit: requirement.unit } },
          create: { name: requirement.resourceName, unit: requirement.unit, category: enumToDb(requirement.category), totalAvailable: 0 },
          update: {}
        });
      }
      if (resource.category !== enumToDb(requirement.category) || resource.unit.toLowerCase() !== requirement.unit.toLowerCase()) {
        throw new ApiError(400, 'INCOMPATIBLE_RESOURCE', 'The selected resource category and unit must match the request.');
      }
      const row = await tx.resourceRequirement.create({ data: {
        requestId: request.id,
        resourceId: resource.id,
        quantityNeeded: requirement.quantityNeeded
      } });
      resources.push({ id: resource.id, name: resource.name, quantityNeeded: row.quantityNeeded });
    }

    const generatedTasks = requestedTasks.length ? undefined : createTaskPlan({ requestId: request.id, category: data.category, locationArea: data.locationArea, resources });
    const generatedInputs = generatedTasks?.map((task) => ({
      title: task.title,
      description: task.description,
      requiredSkills: task.requiredSkills,
      estimatedMinutes: task.estimatedMinutes,
      dependencyIndexes: task.dependsOnTaskIds.map((dependencyId) => generatedTasks.findIndex((candidate) => candidate.id === dependencyId)),
      requiredResourceIndex: task.requiredResourceId ? resources.findIndex((resource) => resource.id === task.requiredResourceId) : undefined,
      requiredResourceQuantity: task.requiredResourceQuantity,
      prerequisites: (task.prerequisites || []).map((prerequisite) => ({
        type: prerequisite.type,
        title: prerequisite.title,
        details: prerequisite.details,
        targetTaskIndex: prerequisite.targetTaskId ? generatedTasks.findIndex((candidate) => candidate.id === prerequisite.targetTaskId) : undefined,
        targetResourceIndex: prerequisite.targetResourceId ? resources.findIndex((resource) => resource.id === prerequisite.targetResourceId) : undefined
      }))
    }));
    const sourceTasks = requestedTasks.length ? requestedTasks : generatedInputs || [];
    const taskPlan: ActionTask[] = sourceTasks.map((task, index) => ({
      id: `plan-${index}`,
      requestId: request.id,
      order: index + 1,
      title: task.title,
      description: task.description,
      requiredSkills: task.requiredSkills || [],
      estimatedMinutes: task.estimatedMinutes || 30,
      dependsOnTaskIds: [...new Set([...(task.dependencyIndexes || []), ...(task.prerequisites || []).filter((prerequisite) => prerequisite.type === 'TASK_PREREQUISITE' && prerequisite.targetTaskIndex !== undefined).map((prerequisite) => prerequisite.targetTaskIndex as number)])].map((dependencyIndex) => `plan-${dependencyIndex}`),
      requiredResourceId: task.requiredResourceIndex === undefined ? undefined : resources[task.requiredResourceIndex]?.id,
      requiredResourceQuantity: task.requiredResourceQuantity,
      status: 'pending' as TaskStatus
    }));
    for (const task of sourceTasks) {
      for (const dependencyIndex of task.dependencyIndexes || []) {
        if (dependencyIndex >= sourceTasks.length) throw new ApiError(400, 'INVALID_DEPENDENCY', 'A task refers to a prerequisite outside this plan.');
      }
      if (task.requiredResourceIndex !== undefined && !resources[task.requiredResourceIndex]) throw new ApiError(400, 'INVALID_RESOURCE_REFERENCE', 'A task refers to a resource outside this request.');
      for (const prerequisite of task.prerequisites || []) {
        if (prerequisite.type === 'TASK_PREREQUISITE' && prerequisite.targetTaskIndex === undefined) {
          throw new ApiError(400, 'INVALID_DEPENDENCY', 'A task prerequisite must identify its target task.');
        }
        if (prerequisite.targetTaskIndex !== undefined && prerequisite.targetTaskIndex >= sourceTasks.length) {
          throw new ApiError(400, 'INVALID_DEPENDENCY', 'A task prerequisite refers outside this plan.');
        }
        if (prerequisite.type === 'RESOURCE_STOCK' && prerequisite.targetResourceIndex === undefined && task.requiredResourceIndex === undefined) {
          throw new ApiError(400, 'INVALID_RESOURCE_REFERENCE', 'A resource prerequisite must identify its inventory item.');
        }
        if (prerequisite.targetResourceIndex !== undefined && !resources[prerequisite.targetResourceIndex]) {
          throw new ApiError(400, 'INVALID_RESOURCE_REFERENCE', 'A task prerequisite refers outside this request inventory.');
        }
      }
    }
    validateTaskGraph(taskPlan);
    const persistedTasks = [];
    for (let index = 0; index < taskPlan.length; index++) {
      const task = taskPlan[index];
      const source = sourceTasks[index];
      const persisted = await tx.actionTask.create({ data: {
        id: newId(),
        requestId: request.id,
        order: index + 1,
        title: task.title,
        description: task.description,
        requiredSkills: task.requiredSkills,
        estimatedMinutes: task.estimatedMinutes,
        requiredResourceId: task.requiredResourceId,
        requiredResourceQuantity: task.requiredResourceQuantity,
        status: 'PENDING'
      } });
      persistedTasks.push(persisted);
    }
    for (let index = 0; index < taskPlan.length; index++) {
      for (const dependencyId of taskPlan[index].dependsOnTaskIds) {
        const dependencyIndex = taskPlan.findIndex((task) => task.id === dependencyId);
        if (dependencyIndex < 0) throw new ApiError(400, 'INVALID_DEPENDENCY', 'Task dependency does not belong to this request.');
        await tx.taskDependency.create({ data: { prerequisiteTaskId: persistedTasks[dependencyIndex].id, dependentTaskId: persistedTasks[index].id } });
      }
      for (const prerequisite of sourceTasks[index]?.prerequisites || []) {
        const targetTaskId = prerequisite.targetTaskIndex === undefined ? undefined : persistedTasks[prerequisite.targetTaskIndex]?.id;
        const targetResourceId = prerequisite.targetResourceIndex === undefined ? undefined : resources[prerequisite.targetResourceIndex]?.id;
        if (prerequisite.targetTaskIndex !== undefined && targetTaskId === undefined) throw new ApiError(400, 'INVALID_DEPENDENCY', 'A prerequisite refers to a task outside this plan.');
        if (prerequisite.targetResourceIndex !== undefined && targetResourceId === undefined) throw new ApiError(400, 'INVALID_RESOURCE_REFERENCE', 'A prerequisite refers to a resource outside this request.');
        await tx.taskPrerequisite.create({ data: {
          taskId: persistedTasks[index].id,
          type: enumToDb(prerequisite.type),
          title: prerequisite.title,
          details: prerequisite.details,
          targetTaskId,
          targetResourceId
        } });
      }
    }
    for (const resource of resources) await reallocateResource(tx, resource.id);
    await reevaluateRequest(tx, request.id);
    return tx.communityRequest.findUniqueOrThrow({ where: { id: request.id }, include: requestInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json({ success: true, data: serializeRequest(created) });
}));

router.get('/requests/:id', asyncRoute(async (req, res) => {
  const request = await prisma.communityRequest.findUnique({ where: { id: req.params.id }, include: requestInclude });
  if (!request) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Community request was not found.');
  res.json({ success: true, data: serializeRequest(request) });
}));

router.patch('/requests/:id', asyncRoute(async (req, res) => {
  const patchSchema = requestCreateSchema.partial().omit({ resourcesNeeded: true, tasks: true }).strict();
  const data = parseBody(patchSchema, req.body);
  const request = await prisma.$transaction(async (tx) => {
    const existing = await tx.communityRequest.findUnique({ where: { id: req.params.id }, include: { resourcesNeeded: { include: { resource: true } } } });
    if (!existing) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Community request was not found.');
    if (data.category && existing.resourcesNeeded.some((requirement) => requirement.resource.category !== enumToDb(data.category!))) {
      throw new ApiError(409, 'REQUEST_CATEGORY_CONFLICT', 'Request category cannot change while its required resources use another category.');
    }
    const updated = await tx.communityRequest.update({ where: { id: existing.id }, data: {
      ...data,
      category: data.category ? enumToDb(data.category) : undefined,
      urgency: data.urgency ? enumToDb(data.urgency) : undefined
    } });
    if (data.urgency) {
      for (const requirement of existing.resourcesNeeded) await reallocateResource(tx, requirement.resourceId);
      for (const requirement of existing.resourcesNeeded) await refreshResourceRequests(tx, requirement.resourceId);
    }
    return tx.communityRequest.findUniqueOrThrow({ where: { id: updated.id }, include: requestInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ success: true, data: serializeRequest(request) });
}));

router.post('/requests/:id/tasks', asyncRoute(async (req, res) => {
  const data = parseBody(taskCreateSchema, req.body);
  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.communityRequest.findUnique({ where: { id: req.params.id }, include: { tasks: { include: { dependencies: true } } } });
    if (!request) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Community request was not found.');
    const dependencyIds = data.dependencyIds || [];
    const invalidDependency = dependencyIds.find((id) => !request.tasks.some((task) => task.id === id));
    if (invalidDependency) throw new ApiError(400, 'INVALID_DEPENDENCY', 'A prerequisite task must belong to this request.');
    const resource = data.requiredResourceId ? await tx.resource.findUnique({ where: { id: data.requiredResourceId } }) : null;
    if (data.requiredResourceId && !resource) throw new ApiError(400, 'RESOURCE_NOT_FOUND', 'Required inventory resource was not found.');
    if (resource) {
      const requirement = await tx.resourceRequirement.findUnique({ where: { requestId_resourceId: { requestId: request.id, resourceId: resource.id } } });
      if (!requirement) {
        await tx.resourceRequirement.create({ data: {
          requestId: request.id,
          resourceId: resource.id,
          quantityNeeded: data.requiredResourceQuantity || 1
        } });
        await reallocateResource(tx, resource.id);
      } else if (data.requiredResourceQuantity && data.requiredResourceQuantity > requirement.quantityNeeded) {
        throw new ApiError(400, 'RESOURCE_REQUIREMENT_TOO_SMALL', 'Task resource quantity cannot exceed the request quantity.');
      }
    }
    const id = newId();
    const task = await tx.actionTask.create({ data: {
      id,
      requestId: request.id,
      order: Math.max(0, ...request.tasks.map((item) => item.order)) + 1,
      title: data.title,
      description: data.description,
      requiredSkills: data.requiredSkills || [],
      estimatedMinutes: data.estimatedMinutes || 30,
      requiredResourceId: data.requiredResourceId,
      requiredResourceQuantity: data.requiredResourceQuantity,
      status: 'PENDING',
      dependencies: { create: dependencyIds.map((prerequisiteTaskId) => ({ prerequisiteTaskId })) }
    } });
    const graph = [...request.tasks.map((item) => ({ id: item.id, requestId: item.requestId, title: item.title, description: item.description, requiredSkills: item.requiredSkills, estimatedMinutes: item.estimatedMinutes, dependsOnTaskIds: item.dependencies.map((dependency) => dependency.prerequisiteTaskId), status: enumToUi<TaskStatus>(item.status), order: item.order } as ActionTask)), { id, requestId: request.id, title: task.title, description: task.description, requiredSkills: task.requiredSkills, estimatedMinutes: task.estimatedMinutes, dependsOnTaskIds: dependencyIds, status: 'pending' as TaskStatus, order: task.order }];
    validateTaskGraph(graph);
    await reevaluateRequest(tx, request.id);
    if (resource) await refreshResourceRequests(tx, resource.id);
    return tx.actionTask.findUniqueOrThrow({ where: { id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json({ success: true, data: created });
}));

router.get('/volunteers', asyncRoute(async (_req, res) => {
  const volunteers = await prisma.volunteerProfile.findMany({ include: volunteerInclude, orderBy: { createdAt: 'asc' } });
  res.json({ success: true, data: volunteers.map(serializeVolunteer) });
}));

router.post('/volunteers', publicWriteLimit, asyncRoute(async (req, res) => {
  const data = parseBody(volunteerCreateSchema, req.body);
  const user = await prisma.user.create({ data: {
    name: data.name,
    email: data.email,
    role: 'VOLUNTEER',
    volunteerProfile: { create: {
      phone: data.phone,
      avatar: data.avatar,
      availabilityStatus: enumToDb(data.availabilityStatus || 'available'),
      hoursPerWeek: data.hoursPerWeek || 0,
      timeSlots: data.timeSlots || [],
      verified: false,
      skills: { create: (data.skills || []).map((skill) => ({ skill })) },
      serviceAreas: { create: (data.serviceAreas || []).map((area) => ({ area })) }
    } },
  } });
  const profile = await prisma.volunteerProfile.findUniqueOrThrow({ where: { userId: user.id }, include: volunteerInclude });
  res.status(201).json({ success: true, data: serializeVolunteer(profile) });
}));

router.patch('/volunteers/:id', asyncRoute(async (req, res) => {
  const data = parseBody(volunteerUpdateSchema, req.body);
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.volunteerProfile.findUnique({ where: { userId: req.params.id } });
    if (!existing) throw new ApiError(404, 'VOLUNTEER_NOT_FOUND', 'Volunteer profile was not found.');
    if (data.availabilityStatus === 'available') {
      const activeAssignmentCount = await tx.volunteerAssignment.count({ where: { volunteerId: req.params.id, status: 'ACTIVE' } });
      if (activeAssignmentCount > 0) throw new ApiError(409, 'VOLUNTEER_HAS_ACTIVE_ASSIGNMENT', 'Complete the active assignment before marking this volunteer available.');
    }
    const profile = await tx.volunteerProfile.update({ where: { userId: req.params.id }, data: {
      availabilityStatus: data.availabilityStatus ? enumToDb(data.availabilityStatus) : undefined,
      hoursPerWeek: data.hoursPerWeek,
      timeSlots: data.timeSlots
    } });
    if (data.skills) {
      await tx.volunteerSkill.deleteMany({ where: { volunteerId: req.params.id } });
      await tx.volunteerSkill.createMany({ data: data.skills.map((skill) => ({ volunteerId: req.params.id, skill })) });
    }
    if (data.serviceAreas) {
      await tx.volunteerServiceArea.deleteMany({ where: { volunteerId: req.params.id } });
      await tx.volunteerServiceArea.createMany({ data: data.serviceAreas.map((area) => ({ volunteerId: req.params.id, area })) });
    }
    return tx.volunteerProfile.findUniqueOrThrow({ where: { userId: req.params.id }, include: volunteerInclude });
  });
  res.json({ success: true, data: serializeVolunteer(updated) });
}));

router.get('/resources', asyncRoute(async (_req, res) => {
  const resources = await prisma.resource.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: resources.map(serializeResource) });
}));

router.post('/resources', asyncRoute(async (req, res) => {
  const data = parseBody(resourceCreateSchema, req.body);
  const resource = await prisma.resource.create({ data: { ...data, category: enumToDb(data.category) } });
  res.status(201).json({ success: true, data: serializeResource(resource) });
}));

router.patch('/resources/:id', asyncRoute(async (req, res) => {
  const data = parseBody(resourceUpdateSchema, req.body);
  const existing = await prisma.resource.findUnique({ where: { id: req.params.id }, include: { requirements: true } });
  if (!existing) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Resource was not found.');
  if (existing.requirements.length && (data.category || data.unit) &&
      (data.category && enumToDb(data.category) !== existing.category || data.unit && data.unit !== existing.unit)) {
    throw new ApiError(409, 'RESOURCE_IN_USE', 'Category and unit cannot change while requests depend on this resource.');
  }
  const resource = await prisma.resource.update({ where: { id: req.params.id }, data: {
    ...data,
    category: data.category ? enumToDb(data.category) : undefined
  } });
  res.json({ success: true, data: serializeResource(resource) });
}));

router.post('/resources/:id/replenish', asyncRoute(async (req, res) => {
  const { quantity } = parseBody(quantitySchema, req.body);
  const resource = await prisma.$transaction(async (tx) => {
    const exists = await tx.resource.findUnique({ where: { id: req.params.id } });
    if (!exists) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Resource was not found.');
    await tx.resource.update({ where: { id: req.params.id }, data: { totalAvailable: { increment: quantity } } });
    await reallocateResource(tx, req.params.id);
    await refreshResourceRequests(tx, req.params.id);
    return tx.resource.findUniqueOrThrow({ where: { id: req.params.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ success: true, data: serializeResource(resource) });
}));

const resourceAllocationSchema = z.object({ resourceId: z.string().min(1).max(30) }).strict();
const volunteerIdSchema = z.object({ volunteerId: z.string().min(1).max(30) }).strict();

router.post('/requests/:id/allocations', asyncRoute(async (req, res) => {
  const body = resourceAllocationSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Select a valid resource to allocate.', body.error.issues);
  const allocation = await prisma.$transaction(async (tx) => {
    const requirement = await tx.resourceRequirement.findUnique({ where: { requestId_resourceId: { requestId: req.params.id, resourceId: body.data.resourceId } } });
    if (!requirement) throw new ApiError(404, 'REQUIREMENT_NOT_FOUND', 'This request does not require the selected resource.');
    await reallocateResource(tx, requirement.resourceId);
    await refreshResourceRequests(tx, requirement.resourceId);
    const active = await tx.resourceAllocation.aggregate({ where: { requirementId: requirement.id, status: 'ACTIVE' }, _sum: { quantity: true } });
    return { requirementId: requirement.id, quantityAllocated: active._sum.quantity || 0, quantityNeeded: requirement.quantityNeeded };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ success: true, data: allocation });
}));

router.get('/tasks/:id/matches', asyncRoute(async (req, res) => {
  const task = await prisma.actionTask.findUnique({ where: { id: req.params.id }, include: { request: true, dependencies: true, assignments: { where: { status: 'ACTIVE' } } } });
  if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'Task was not found.');
  const profiles = await prisma.volunteerProfile.findMany({ include: { user: true, skills: true, serviceAreas: true, assignments: { where: { status: 'ACTIVE' } } } });
  const domainTask: ActionTask = {
    id: task.id, requestId: task.requestId, order: task.order, title: task.title, description: task.description,
    requiredSkills: task.requiredSkills, estimatedMinutes: task.estimatedMinutes,
    dependsOnTaskIds: task.dependencies.map((dependency) => dependency.prerequisiteTaskId), status: enumToUi<TaskStatus>(task.status)
  };
  const domainRequest = await prisma.communityRequest.findUnique({ where: { id: task.requestId }, include: requestInclude });
  const requestData = domainRequest && serializeRequest(domainRequest);
  if (!requestData) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Community request was not found.');
  const volunteers: Volunteer[] = profiles.map((profile) => ({
    id: profile.userId, name: profile.user.name, email: profile.user.email || '', phone: profile.phone || '', avatar: profile.avatar || '',
    skills: profile.skills.map((skill) => skill.skill), serviceAreas: profile.serviceAreas.map((area) => area.area),
    availabilityStatus: enumToUi(profile.availabilityStatus) as Volunteer['availabilityStatus'], hoursPerWeek: profile.hoursPerWeek,
    timeSlots: [], rating: profile.rating, completedTasksCount: profile.completedTasksCount,
    currentAssignedTaskId: profile.assignments[0]?.taskId, verified: profile.verified
  }));
  res.json({ success: true, data: rankVolunteersForTask(domainTask, requestData, volunteers) });
}));

router.post('/tasks/:id/assignments', asyncRoute(async (req, res) => {
  const data = parseBody(volunteerIdSchema, req.body);
  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.actionTask.findUnique({ where: { id: req.params.id }, include: { request: true, dependencies: true, assignments: { where: { status: 'ACTIVE' } } } });
    if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'Task was not found.');
    await reevaluateRequest(tx, task.requestId);
    const current = await tx.actionTask.findUniqueOrThrow({ where: { id: task.id }, include: { request: true, dependencies: true, assignments: { where: { status: 'ACTIVE' } } } });
    if (current.status !== 'READY') throw new ApiError(409, 'TASK_NOT_READY', 'Task must be READY before assignment.');
    if (current.assignments.length) throw new ApiError(409, 'TASK_ASSIGNED', 'Task already has an active volunteer assignment.');
    const volunteer = await tx.volunteerProfile.findUnique({ where: { userId: data.volunteerId }, include: { skills: true, serviceAreas: true, assignments: { where: { status: 'ACTIVE' } } } });
    if (!volunteer) throw new ApiError(404, 'VOLUNTEER_NOT_FOUND', 'Volunteer profile was not found.');
    if (!volunteer.verified || volunteer.availabilityStatus !== 'AVAILABLE' || volunteer.assignments.length) throw new ApiError(409, 'VOLUNTEER_UNAVAILABLE', 'Volunteer must be verified, available, and unassigned.');
    const hasSkills = current.requiredSkills.every((required) => volunteer.skills.some((skill) => skill.skill.toLowerCase() === required.toLowerCase()));
    const inArea = volunteer.serviceAreas.some((area) => area.area.toLowerCase() === current.request.locationArea.toLowerCase() || area.area.toLowerCase() === 'all wards');
    if (!hasSkills || !inArea) throw new ApiError(422, 'VOLUNTEER_INELIGIBLE', 'Volunteer does not meet all required skills and service-area criteria.');
    const assignment = await tx.volunteerAssignment.create({ data: { taskId: current.id, volunteerId: data.volunteerId } });
    await tx.volunteerProfile.update({ where: { userId: data.volunteerId }, data: { availabilityStatus: 'BUSY' } });
    await reevaluateRequest(tx, current.requestId);
    return assignment;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json({ success: true, data: result });
}));

router.patch('/tasks/:id/status', asyncRoute(async (req, res) => {
  const data = parseBody(taskStatusUpdateSchema, req.body);
  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.actionTask.findUnique({ where: { id: req.params.id }, include: { request: true, dependencies: true, assignments: { where: { status: 'ACTIVE' } } } });
    if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'Task was not found.');
    await reevaluateRequest(tx, task.requestId);
    const current = await tx.actionTask.findUniqueOrThrow({ where: { id: task.id }, include: { dependencies: true } });
    const nextStatus = enumToDb(data.status) as DbTaskStatus;
    if (data.status === 'in_progress') {
      if (current.status !== 'READY') throw new ApiError(409, 'TASK_NOT_READY', 'Task must be READY before it can start.');
      if (!task.assignments.length) throw new ApiError(409, 'TASK_UNASSIGNED', 'Assign an eligible volunteer before starting the task.');
    }
    if (data.status === 'completed') {
      if (current.status !== 'IN_PROGRESS') throw new ApiError(409, 'INVALID_TRANSITION', 'Task must be IN_PROGRESS before completion.');
      if (task.dependencies.length) {
        const unfinished = await tx.actionTask.count({ where: { id: { in: task.dependencies.map((dependency) => dependency.prerequisiteTaskId) }, status: { not: 'COMPLETED' } } });
        if (unfinished) throw new ApiError(409, 'PREREQUISITES_INCOMPLETE', 'Task prerequisites must be completed first.');
      }
    }
    const updated = await tx.actionTask.update({ where: { id: task.id }, data: {
      status: nextStatus,
      notes: data.notes,
      startedAt: data.status === 'in_progress' ? new Date() : undefined,
      completedAt: data.status === 'completed' ? new Date() : undefined
    } });
    if (data.status === 'completed' && task.assignments[0]) {
      await tx.volunteerAssignment.updateMany({ where: { taskId: task.id, status: 'ACTIVE' }, data: { status: 'COMPLETED', releasedAt: new Date() } });
      await tx.volunteerProfile.update({ where: { userId: task.assignments[0].volunteerId }, data: { completedTasksCount: { increment: 1 }, availabilityStatus: 'AVAILABLE' } });
    }
    await reevaluateRequest(tx, task.requestId);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ success: true, data: result });
}));

router.post('/requests/:id/confirm', asyncRoute(async (req, res) => {
  const data = parseBody(confirmationSchema, req.body);
  const request = await prisma.$transaction(async (tx) => {
    const existing = await tx.communityRequest.findUnique({ where: { id: req.params.id }, include: { tasks: true, outcomeConfirmation: true } });
    if (!existing) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Community request was not found.');
    const isDisputeFollowUp = existing.status === 'BLOCKED' && Boolean(existing.outcomeConfirmation?.disputed);
    if (existing.status !== 'AWAITING_CONFIRMATION' && !isDisputeFollowUp) {
      throw new ApiError(409, 'REQUEST_NOT_READY_FOR_CONFIRMATION', 'Complete all operational tasks before confirming the outcome.');
    }
    const confirmation = await tx.outcomeConfirmation.upsert({ where: { requestId: existing.id }, create: {
      requestId: existing.id, confirmed: data.confirmed, feedback: data.feedback, disputed: data.disputed, disputeReason: data.disputeReason
    }, update: { confirmed: data.confirmed, feedback: data.feedback, disputed: data.disputed, disputeReason: data.disputeReason, confirmedAt: new Date() } });
    if (data.confirmed) {
      await tx.communityRequest.update({ where: { id: existing.id }, data: { status: 'RESOLVED' } });
      const allocations = await tx.resourceAllocation.findMany({ where: { requirement: { requestId: existing.id }, status: 'ACTIVE' } });
      for (const allocation of allocations) {
        await tx.resource.update({ where: { id: (await tx.resourceRequirement.findUniqueOrThrow({ where: { id: allocation.requirementId } })).resourceId }, data: { totalAvailable: { decrement: allocation.quantity }, allocated: { decrement: allocation.quantity } } });
      }
      await tx.resourceAllocation.updateMany({ where: { requirement: { requestId: existing.id }, status: 'ACTIVE' }, data: { status: 'CONSUMED', releasedAt: new Date() } });
    } else {
      await tx.communityRequest.update({ where: { id: existing.id }, data: { status: 'BLOCKED' } });
    }
    return { confirmation, request: await tx.communityRequest.findUniqueOrThrow({ where: { id: existing.id }, include: requestInclude }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ success: true, data: { ...serializeRequest(request.request), recipientConfirmation: request.confirmation } });
}));

router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  if (error instanceof ApiError) {
    res.status(error.status).json({ success: false, error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, error: { code: 'DUPLICATE_RECORD', message: 'A record with those unique values already exists.' } });
      return;
    }
    if (error.code === 'P2003' || error.code === 'P2014') {
      res.status(409).json({ success: false, error: { code: 'RELATED_RECORD_CONFLICT', message: 'The operation conflicts with related records.' } });
      return;
    }
    if (error.code === 'P2034') {
      res.status(409).json({ success: false, error: { code: 'CONCURRENT_UPDATE', message: 'Concurrent update conflict. Please retry.' } });
      return;
    }
  }
  if (error instanceof Error && error.name === 'PrismaClientInitializationError') {
    res.status(503).json({ success: false, error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'PostgreSQL is unavailable. Start PostgreSQL, set DATABASE_URL in .env, then run npm run db:migrate and npm run db:seed.'
    } });
    return;
  }
  console.error('[API] Unhandled request error:', error instanceof Error ? error.name : 'Unknown error');
  res.status(503).json({ success: false, error: { code: 'DATABASE_OR_SERVER_ERROR', message: 'The request could not be completed.' } });
});

export const apiRouter = router;
