import { INITIAL_RESOURCES, INITIAL_VOLUNTEERS } from '../src/data/seedData';
import { NeedToActionEngine } from '../src/services/plannerEngine';
import { prisma } from './db';
import { Prisma } from '@prisma/client';

const dbCategory = (value: string) => value.toUpperCase() as never;
export async function seedDatabase() {
  for (const resource of INITIAL_RESOURCES) {
    await prisma.resource.upsert({
      where: { id: resource.id },
      create: {
        id: resource.id,
        name: resource.name,
        category: dbCategory(resource.category),
        unit: resource.unit,
        totalAvailable: resource.totalAvailable,
        notes: 'Humanova sample inventory'
      },
      update: {}
    });
  }

  for (const volunteer of INITIAL_VOLUNTEERS) {
    const user = await prisma.user.upsert({
      where: { id: volunteer.id },
      create: {
        id: volunteer.id,
        name: volunteer.name,
        email: volunteer.email,
        role: 'VOLUNTEER'
      },
      update: {}
    });
    await prisma.volunteerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        phone: volunteer.phone,
        avatar: volunteer.avatar,
        availabilityStatus: 'AVAILABLE',
        hoursPerWeek: volunteer.hoursPerWeek,
        timeSlots: volunteer.timeSlots,
        rating: 0,
        completedTasksCount: 0,
        verified: volunteer.verified
      },
      update: {}
    });
    await prisma.volunteerSkill.createMany({
      data: volunteer.skills.map((skill) => ({ volunteerId: user.id, skill, verified: volunteer.verified })),
      skipDuplicates: true
    });
    await prisma.volunteerServiceArea.createMany({
      data: volunteer.serviceAreas.map((area) => ({ volunteerId: user.id, area })),
      skipDuplicates: true
    });
  }

  const sampleRequests = [
    {
      id: 'ds1',
      trackingCode: 'HNV-2041',
      title: 'Senior Center Meal Support',
      description: 'Sample request: 12 seniors need prepared lunch meals at the community center.',
      locationArea: 'Downtown District',
      recipientName: 'Pineview Senior Center',
      recipientContact: 'Contact pending',
      quantityNeeded: 12,
      createdAt: new Date('2026-10-23T06:30:00.000Z')
    },
    {
      id: 'df1',
      trackingCode: 'HNV-2042',
      title: 'Family Shelter Meal Support',
      description: 'Sample request: 8 family meal kits are needed at the Eastside shelter.',
      locationArea: 'Eastside Ward',
      recipientName: 'Hope Haven Shelter',
      recipientContact: 'Contact pending',
      quantityNeeded: 8,
      createdAt: new Date('2026-10-23T07:00:00.000Z')
    }
  ];

  for (const sample of sampleRequests) {
    await prisma.communityRequest.upsert({
      where: { id: sample.id },
      create: {
        ...sample,
        category: 'FOOD_NUTRITION',
        urgency: 'HIGH',
        status: 'OPEN',
        isDemoSample: true
      },
      update: {}
    });
    const requirement = await prisma.resourceRequirement.upsert({
      where: { requestId_resourceId: { requestId: sample.id, resourceId: 'res-meals' } },
      create: { requestId: sample.id, resourceId: 'res-meals', quantityNeeded: sample.quantityNeeded },
      update: {}
    });
    const plan = NeedToActionEngine.convertNeedToTasks(sample.id, 'food_nutrition', sample.locationArea, [{
      resourceId: 'res-meals',
      resourceName: 'Prepared Nutritious Meals',
      quantityNeeded: sample.quantityNeeded,
      quantityAllocated: 0,
      isSatisfied: false
    }]);

    for (const task of plan) {
      await prisma.actionTask.upsert({
        where: { id: task.id },
        create: {
          id: task.id,
          requestId: sample.id,
          order: task.order,
          title: task.title,
          description: task.description,
          requiredSkills: task.requiredSkills,
          estimatedMinutes: task.estimatedMinutes,
          requiredResourceId: task.requiredResourceId,
          requiredResourceQuantity: task.requiredResourceQuantity,
          status: task.status.toUpperCase() as never,
          blockedReason: task.blockedReason
        },
        update: {}
      });
    }
    for (const task of plan) {
      for (const prerequisiteTaskId of task.dependsOnTaskIds) {
        await prisma.taskDependency.upsert({
          where: { prerequisiteTaskId_dependentTaskId: { prerequisiteTaskId, dependentTaskId: task.id } },
          create: { prerequisiteTaskId, dependentTaskId: task.id },
          update: {}
        });
      }
      for (const prerequisite of task.prerequisites || []) {
        await prisma.taskPrerequisite.upsert({
          where: { id: prerequisite.id },
          create: {
            id: prerequisite.id,
            taskId: task.id,
            type: prerequisite.type as never,
            title: prerequisite.title,
            details: prerequisite.details,
            targetTaskId: prerequisite.targetTaskId,
            targetResourceId: prerequisite.targetResourceId
          },
          update: {}
        });
      }
    }
    const { reallocateResource, reevaluateRequest } = await import('./api');
    await prisma.$transaction(async (tx) => {
      await reallocateResource(tx, requirement.resourceId);
      await reevaluateRequest(tx, sample.id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

