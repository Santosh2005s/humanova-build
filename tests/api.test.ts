import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { after, test } from 'node:test';
import { apiRouter, validateTaskGraph } from '../server/api';
import { prisma } from '../server/db';
import { recalculateResourceAllocations } from '../src/services/resourceEngine';
import { findTaskDependencyIssues } from '../src/services/plannerEngine';
import { rankVolunteersForTask } from '../src/services/volunteerMatcher';
import { taskStatusUpdateSchema } from '../server/validation';
import { CommunityRequest, ResourceItem } from '../src/types';

async function openTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

async function jsonRequest<T>(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  const body = await response.json() as T;
  return { response, body };
}

let databaseAvailable = false;
try {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  databaseAvailable = true;
} catch {
  databaseAvailable = false;
}

const resourceEngineFixture = (id: string, totalAvailable: number): ResourceItem => ({
  id,
  name: 'Meal kits',
  category: 'food_nutrition',
  unit: 'kits',
  totalAvailable,
  allocated: 0
});

const communityRequestFixture = (id: string, quantityNeeded: number, createdAt: string): CommunityRequest => ({
  id,
  trackingCode: id,
  title: id,
  description: id,
  category: 'food_nutrition',
  urgency: 'critical',
  locationArea: 'North Hills',
  recipientName: 'Test recipient',
  recipientContact: 'Contact pending',
  createdAt,
  updatedAt: createdAt,
  status: 'open',
  resourcesNeeded: [{ resourceId: 'fixture-resource', resourceName: 'Meal kits', quantityNeeded, quantityAllocated: 0, isSatisfied: false }],
  tasks: []
});

test('resource engine allocates no more than stock and keeps oldest equal-priority requests first', () => {
  const result = recalculateResourceAllocations([
    communityRequestFixture('newer', 4, '2026-10-24T10:00:00.000Z'),
    communityRequestFixture('older', 4, '2026-10-24T09:00:00.000Z')
  ], [resourceEngineFixture('fixture-resource', 5)]);
  const older = result.updatedRequests.find((request) => request.id === 'older');
  const newer = result.updatedRequests.find((request) => request.id === 'newer');
  assert.equal(older?.resourcesNeeded[0].quantityAllocated, 4);
  assert.equal(newer?.resourcesNeeded[0].quantityAllocated, 1);
  assert.equal(result.updatedInventory[0].allocated, 5);
  assert.ok(result.updatedInventory[0].allocated <= result.updatedInventory[0].totalAvailable);
});

test('dependency cycle detector reports every task in the cycle', () => {
  const tasks = [
    { id: 'a', requestId: 'r', title: 'A', description: 'A', requiredSkills: [], estimatedMinutes: 1, dependsOnTaskIds: ['b'], status: 'blocked' as const, order: 1 },
    { id: 'b', requestId: 'r', title: 'B', description: 'B', requiredSkills: [], estimatedMinutes: 1, dependsOnTaskIds: ['a'], status: 'blocked' as const, order: 2 }
  ];
  const issues = findTaskDependencyIssues(tasks);
  assert.equal(issues.has('a'), true);
  assert.equal(issues.has('b'), true);
  assert.throws(() => validateTaskGraph(tasks), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'DEPENDENCY_CYCLE');
});

test('matching requires verified skill, service-area, and availability eligibility', () => {
  const request = communityRequestFixture('match-request', 1, '2026-10-24T09:00:00.000Z');
  request.locationArea = 'North Hills';
  const task = { id: 'match-task', requestId: request.id, order: 1, title: 'Pack', description: 'Pack supplies.', requiredSkills: ['Packing'], estimatedMinutes: 10, dependsOnTaskIds: [], status: 'ready' as const };
  request.tasks = [task];
  const volunteer = { id: 'vol-test', name: 'Volunteer', email: 'test@example.invalid', phone: '', avatar: '', skills: ['Packing'], serviceAreas: ['North Hills'], availabilityStatus: 'available' as const, hoursPerWeek: 4, timeSlots: ['Morning'], rating: 0, completedTasksCount: 0, verified: true };
  assert.equal(rankVolunteersForTask(task, request, [volunteer], [request])[0].isEligible, true);
  assert.equal(rankVolunteersForTask(task, request, [{ ...volunteer, serviceAreas: ['West End'] }], [request])[0].isEligible, false);
  assert.equal(taskStatusUpdateSchema.safeParse({ status: 'ready' }).success, false);
});

test('API returns a structured error when PostgreSQL is unavailable', { skip: databaseAvailable }, async () => {
  const server = await openTestServer();
  try {
    const { response, body } = await jsonRequest<{ success: boolean; error: { code: string } }>(server.baseUrl, '/state');
    assert.equal(response.status, 503);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
  } finally {
    await server.close();
  }
});

test('PostgreSQL API request, matching, allocation, dependencies, and outcomes', { skip: !databaseAvailable }, async (context) => {
  const server = await openTestServer();
  const unique = `test-${Date.now()}`;
  let resourceId: string | undefined;
  let volunteerId: string | undefined;
  let requestId: string | undefined;
  let competingRequestId: string | undefined;
  try {
    const resourceResponse = await jsonRequest<{ success: boolean; data: { id: string } }>(server.baseUrl, '/resources', {
      method: 'POST', body: JSON.stringify({ name: `API Test Kits ${unique}`, category: 'food_nutrition', unit: 'kits', totalAvailable: 6 })
    });
    assert.equal(resourceResponse.response.status, 201);
    resourceId = resourceResponse.body.data.id;

    const requestResponse = await jsonRequest<{ success: boolean; data: { id: string; tasks: Array<{ id: string; status: string }> } }>(server.baseUrl, '/requests', {
      method: 'POST', body: JSON.stringify({
        title: `API test request ${unique}`,
        description: 'Need four kits for testing a safe DB-backed workflow.',
        category: 'food_nutrition', urgency: 'high', locationArea: 'North Hills', recipientName: 'Test recipient', recipientContact: 'test@example.invalid',
        resourcesNeeded: [{ resourceId, resourceName: `API Test Kits ${unique}`, category: 'food_nutrition', unit: 'kits', quantityNeeded: 4 }],
        tasks: [
          { title: 'Pack kits', description: 'Pack the allocated kits.', requiredSkills: ['Packing'], estimatedMinutes: 15, dependencyIndexes: [], requiredResourceIndex: 0, requiredResourceQuantity: 4 },
          { title: 'Deliver kits', description: 'Deliver after packing is complete.', requiredSkills: ['Vehicle Delivery'], estimatedMinutes: 20, dependencyIndexes: [0] },
          { title: 'Complete handoff', description: 'Record the recipient handoff.', requiredSkills: ['Food Handling'], estimatedMinutes: 10, dependencyIndexes: [1] },
          { title: 'Recipient confirmation and sign-off', description: 'Await direct recipient outcome verification.', requiredSkills: [], estimatedMinutes: 5, dependencyIndexes: [2] }
        ]
      })
    });
    assert.equal(requestResponse.response.status, 201);
    requestId = requestResponse.body.data.id;
    assert.equal(requestResponse.body.data.tasks[0].status, 'ready');
    assert.equal(requestResponse.body.data.tasks[1].status, 'blocked');
    const firstTaskId = requestResponse.body.data.tasks[0].id;
    const secondTaskId = requestResponse.body.data.tasks[1].id;
    const handoffTaskId = requestResponse.body.data.tasks[2].id;

    const competingRequest = await jsonRequest<{ data: { id: string; resourcesNeeded: Array<{ quantityAllocated: number; quantityNeeded: number }>; tasks: Array<{ status: string }> } }>(server.baseUrl, '/requests', {
      method: 'POST', body: JSON.stringify({
        title: `Competing API test request ${unique}`,
        description: 'Competing demand verifies shortage allocation.',
        category: 'food_nutrition', urgency: 'low', locationArea: 'North Hills', recipientName: 'Second test recipient', recipientContact: 'second@example.invalid',
        resourcesNeeded: [{ resourceId, resourceName: `API Test Kits ${unique}`, category: 'food_nutrition', unit: 'kits', quantityNeeded: 4 }],
        tasks: []
      })
    });
    assert.equal(competingRequest.response.status, 201);
    competingRequestId = competingRequest.body.data.id;
    assert.equal(competingRequest.body.data.resourcesNeeded[0].quantityAllocated, 2);
    assert.equal(competingRequest.body.data.resourcesNeeded[0].quantityNeeded, 4);
    assert.equal(competingRequest.body.data.tasks[0].status, 'blocked');

    await context.test('rejects circular dependencies before saving', async () => {
      const { response, body } = await jsonRequest<{ error: { code: string } }>(server.baseUrl, '/requests', {
        method: 'POST', body: JSON.stringify({
          title: `Cycle ${unique}`, description: 'Cycle test.', category: 'food_nutrition', urgency: 'medium', locationArea: 'North Hills', recipientName: 'Test', recipientContact: 'test@example.invalid',
          resourcesNeeded: [{ resourceName: `Cycle Kits ${unique}`, category: 'food_nutrition', unit: 'kits', quantityNeeded: 1 }],
          tasks: [
            { title: 'A', description: 'A', requiredSkills: [], estimatedMinutes: 1, dependencyIndexes: [1] },
            { title: 'B', description: 'B', requiredSkills: [], estimatedMinutes: 1, dependencyIndexes: [0] }
          ]
        })
      });
      assert.equal(response.status, 400);
      assert.equal(body.error.code, 'DEPENDENCY_CYCLE');
    });

    const volunteerResponse = await jsonRequest<{ data: { id: string } }>(server.baseUrl, '/volunteers', {
      method: 'POST', body: JSON.stringify({ name: `API Test Volunteer ${unique}`, email: `${unique}@example.invalid`, skills: ['Packing'], serviceAreas: ['North Hills'], timeSlots: ['Morning'] })
    });
    assert.equal(volunteerResponse.response.status, 201);
    volunteerId = volunteerResponse.body.data.id;
    await prisma.volunteerProfile.update({ where: { userId: volunteerId }, data: { verified: true } });

    const matches = await jsonRequest<{ data: Array<{ volunteer: { id: string }; isEligible: boolean }> }>(server.baseUrl, `/tasks/${firstTaskId}/matches`);
    assert.equal(matches.body.data.find((match) => match.volunteer.id === volunteerId)?.isEligible, true);

    const assignment = await jsonRequest<{ success: boolean }>(server.baseUrl, `/tasks/${firstTaskId}/assignments`, {
      method: 'POST', body: JSON.stringify({ volunteerId })
    });
    assert.equal(assignment.response.status, 201);

    const duplicate = await jsonRequest<{ error: { code: string } }>(server.baseUrl, `/tasks/${secondTaskId}/assignments`, {
      method: 'POST', body: JSON.stringify({ volunteerId })
    });
    assert.equal(duplicate.response.status, 409);

    await jsonRequest(server.baseUrl, `/tasks/${firstTaskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) });
    await jsonRequest(server.baseUrl, `/tasks/${firstTaskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
    const nextState = await jsonRequest<{ data: { tasks: Array<{ id: string; status: string }> } }>(server.baseUrl, `/requests/${requestId}`);
    assert.equal(nextState.body.data.tasks.find((task) => task.id === secondTaskId)?.status, 'ready');

    const secondVolunteer = await prisma.volunteerProfile.update({ where: { userId: volunteerId }, data: { availabilityStatus: 'AVAILABLE' } });
    assert.equal(secondVolunteer.availabilityStatus, 'AVAILABLE');
    await prisma.volunteerSkill.createMany({ data: [
      { volunteerId, skill: 'Vehicle Delivery' },
      { volunteerId, skill: 'Food Handling' }
    ] });
    await jsonRequest(server.baseUrl, `/tasks/${secondTaskId}/assignments`, { method: 'POST', body: JSON.stringify({ volunteerId }) });
    await jsonRequest(server.baseUrl, `/tasks/${secondTaskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) });
    await jsonRequest(server.baseUrl, `/tasks/${secondTaskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
    await jsonRequest(server.baseUrl, `/tasks/${handoffTaskId}/assignments`, { method: 'POST', body: JSON.stringify({ volunteerId }) });
    await jsonRequest(server.baseUrl, `/tasks/${handoffTaskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) });
    await jsonRequest(server.baseUrl, `/tasks/${handoffTaskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
    const awaiting = await jsonRequest<{ data: { status: string } }>(server.baseUrl, `/requests/${requestId}`);
    assert.equal(awaiting.body.data.status, 'awaiting_confirmation');

    const confirmation = await jsonRequest<{ data: { status: string } }>(server.baseUrl, `/requests/${requestId}/confirm`, {
      method: 'POST', body: JSON.stringify({ confirmed: true, feedback: 'Integration test only.', disputed: false })
    });
    assert.equal(confirmation.body.data.status, 'resolved');

    const state = await jsonRequest<{ data: { resources: Array<{ id: string; totalAvailable: number; allocated: number }> } }>(server.baseUrl, '/state');
    const allocatedResource = state.body.data.resources.find((resource) => resource.id === resourceId);
    assert.ok(allocatedResource);
    assert.ok(allocatedResource.allocated <= allocatedResource.totalAvailable);
  } finally {
    if (requestId) await prisma.communityRequest.deleteMany({ where: { id: requestId } });
    if (competingRequestId) await prisma.communityRequest.deleteMany({ where: { id: competingRequestId } });
    if (resourceId) await prisma.resource.deleteMany({ where: { id: resourceId } });
    if (volunteerId) await prisma.user.deleteMany({ where: { id: volunteerId } });
    await server.close();
  }
});

after(async () => {
  await prisma.$disconnect();
});
