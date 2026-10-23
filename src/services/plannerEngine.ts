import {
  ActionTask,
  BlockerAnalysis,
  CommunityRequest,
  NeedCategory,
  NextFeasibleAction,
  RequestStatus,
  ResourceRequirement,
  TaskPrerequisite,
  TaskStatus
} from '../types';

/**
 * Need-to-Action Engine
 * Converts community needs into executable task sequences with typed prerequisite graphs,
 * diagnoses root blockers, recommends the single next feasible step, and guards against premature completion.
 */
export const NeedToActionEngine = {
  /**
   * Converts a community need into an ordered sequence of actionable tasks with explicit prerequisites.
   */
  convertNeedToTasks(
    requestId: string,
    category: NeedCategory,
    locationArea: string,
    resourcesNeeded: ResourceRequirement[]
  ): ActionTask[] {
    const primaryResource = resourcesNeeded[0];
    const qty = primaryResource ? primaryResource.quantityNeeded : 1;
    const resName = primaryResource ? primaryResource.resourceName : 'Required Supplies';

    switch (category) {
      case 'food_nutrition': {
        const task1Id = `task-${requestId}-1`;
        const task2Id = `task-${requestId}-2`;
        const task3Id = `task-${requestId}-3`;
        const task4Id = `task-${requestId}-4`;

        return [
          {
            id: task1Id,
            requestId,
            order: 1,
            title: `Inspect, Allergen-Check & Pack ${qty} ${resName}`,
            description: `Assemble food portions in sanitary thermal containers from community kitchen depot.`,
            requiredSkills: ['Food Handling', 'Inventory Packing'],
            estimatedMinutes: 20,
            dependsOnTaskIds: [],
            requiredResourceId: primaryResource?.resourceId,
            requiredResourceQuantity: qty,
            status: 'pending',
            prerequisites: [
              {
                id: `prereq-${task1Id}-res`,
                title: `Pantry Supply Allocation (${qty} units)`,
                type: 'RESOURCE_STOCK',
                isSatisfied: false,
                details: `Requires ${qty} ${resName} allocated from available warehouse stock.`,
                targetResourceId: primaryResource?.resourceId
              },
              {
                id: `prereq-${task1Id}-vol`,
                title: 'Qualified Volunteer Assignment',
                type: 'VOLUNTEER_QUALIFICATION',
                isSatisfied: false,
                details: 'Requires volunteer with "Food Handling" certification.'
              }
            ]
          },
          {
            id: task2Id,
            requestId,
            order: 2,
            title: `Temperature-Controlled Transit to ${locationArea}`,
            description: `Transport packaged meals in insulated thermal carrier to target delivery address.`,
            requiredSkills: ['Vehicle Delivery', 'Food Handling'],
            estimatedMinutes: 30,
            dependsOnTaskIds: [task1Id],
            status: 'blocked',
            blockedReason: 'Prerequisite packing task must finish first.',
            prerequisites: [
              {
                id: `prereq-${task2Id}-task1`,
                title: 'Packaging & Allergen Verification Complete',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: 'Step 1 meal containers must be sealed and labeled.',
                targetTaskId: task1Id
              },
              {
                id: `prereq-${task2Id}-vol`,
                title: 'Delivery Vehicle Mobilization',
                type: 'VOLUNTEER_QUALIFICATION',
                isSatisfied: false,
                details: 'Requires volunteer with "Vehicle Delivery" capacity.'
              }
            ]
          },
          {
            id: task3Id,
            requestId,
            order: 3,
            title: 'Direct Recipient Handoff & Temperature Check',
            description: 'Handoff meals directly to recipient, verifying seal integrity and immediate receipt.',
            requiredSkills: ['Food Handling'],
            estimatedMinutes: 15,
            dependsOnTaskIds: [task2Id],
            status: 'blocked',
            blockedReason: 'Delivery vehicle must arrive on-site first.',
            prerequisites: [
              {
                id: `prereq-${task3Id}-task2`,
                title: 'Courier Arrival at Delivery Address',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: `Courier must reach ${locationArea} doorstep.`,
                targetTaskId: task2Id
              },
              {
                id: `prereq-${task3Id}-contact`,
                title: 'Recipient Access Verification',
                type: 'RECIPIENT_CONTACT',
                isSatisfied: true,
                details: 'Recipient address and contact confirmation verified.'
              }
            ]
          },
          {
            id: task4Id,
            requestId,
            order: 4,
            title: 'Recipient Confirmation & Digital Sign-off',
            description: 'Recipient verifies food receipt, logs meal condition, and signs off on resolved need.',
            requiredSkills: [],
            estimatedMinutes: 10,
            dependsOnTaskIds: [task3Id],
            status: 'blocked',
            blockedReason: 'Awaiting handoff completion before final sign-off.',
            prerequisites: [
              {
                id: `prereq-${task4Id}-task3`,
                title: 'Physical Meal Handoff Finished',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: 'Step 3 handoff must be verified before outcome auditing.',
                targetTaskId: task3Id
              }
            ]
          }
        ];
      }

      case 'medical_health': {
        const task1Id = `task-${requestId}-1`;
        const task2Id = `task-${requestId}-2`;
        const task3Id = `task-${requestId}-3`;

        return [
          {
            id: task1Id,
            requestId,
            order: 1,
            title: `Prescription/Medical Supply Dispatch & Seal Check`,
            description: 'Retrieve authorized medical supply from local health hub with strict tamper-evident seal verification.',
            requiredSkills: ['Prescription Handling', 'First Aid & Medical'],
            estimatedMinutes: 25,
            dependsOnTaskIds: [],
            requiredResourceId: primaryResource?.resourceId,
            requiredResourceQuantity: qty,
            status: 'pending',
            prerequisites: [
              {
                id: `prereq-${task1Id}-res`,
                title: `Medical Supply Allocation (${qty} kit)`,
                type: 'RESOURCE_STOCK',
                isSatisfied: false,
                details: `Requires authorized ${resName} from health inventory.`,
                targetResourceId: primaryResource?.resourceId
              },
              {
                id: `prereq-${task1Id}-vol`,
                title: 'Medical Transport Qualification',
                type: 'VOLUNTEER_QUALIFICATION',
                isSatisfied: false,
                details: 'Requires volunteer certified in "Prescription Handling" or "First Aid & Medical".'
              }
            ]
          },
          {
            id: task2Id,
            requestId,
            order: 2,
            title: `Urgent Delivery & Wellbeing Check in ${locationArea}`,
            description: 'Deliver supplies to recipient doorstep, conduct basic wellness screening if authorized.',
            requiredSkills: ['First Aid & Medical', 'Elderly Care'],
            estimatedMinutes: 30,
            dependsOnTaskIds: [task1Id],
            status: 'blocked',
            blockedReason: 'Cannot dispatch courier until prescription is verified.',
            prerequisites: [
              {
                id: `prereq-${task2Id}-task1`,
                title: 'Prescription Retrieval & Seal Verification',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: 'Step 1 must be completed and tamper seal verified.',
                targetTaskId: task1Id
              }
            ]
          },
          {
            id: task3Id,
            requestId,
            order: 3,
            title: 'Recipient Medical Receipt & Safety Sign-off',
            description: 'Recipient or guardian confirms medication received matches prescribed label.',
            requiredSkills: [],
            estimatedMinutes: 10,
            dependsOnTaskIds: [task2Id],
            status: 'blocked',
            blockedReason: 'Pending physical handoff.',
            prerequisites: [
              {
                id: `prereq-${task3Id}-task2`,
                title: 'Doorstep Delivery Completed',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: 'Step 2 delivery must complete first.',
                targetTaskId: task2Id
              }
            ]
          }
        ];
      }

      case 'emergency_repair': {
        const task1Id = `task-${requestId}-1`;
        const task2Id = `task-${requestId}-2`;
        const task3Id = `task-${requestId}-3`;

        return [
          {
            id: task1Id,
            requestId,
            order: 1,
            title: 'Gear & Tool Kit Mobilization',
            description: 'Load safety gear, weatherized tarps, and repair tools from central equipment locker.',
            requiredSkills: ['Carpentry & Tools', 'Heavy Lifting'],
            estimatedMinutes: 30,
            dependsOnTaskIds: [],
            requiredResourceId: primaryResource?.resourceId,
            requiredResourceQuantity: qty,
            status: 'pending',
            prerequisites: [
              {
                id: `prereq-${task1Id}-res`,
                title: `Equipment Allocation (${qty} ${resName})`,
                type: 'RESOURCE_STOCK',
                isSatisfied: false,
                details: `Requires ${qty} units of repair tarps/tools available in inventory.`,
                targetResourceId: primaryResource?.resourceId
              }
            ]
          },
          {
            id: task2Id,
            requestId,
            order: 2,
            title: `On-Site Structural Stabilization in ${locationArea}`,
            description: 'Deploy weatherized covering, secure exterior leak points, and ensure structural hazard clearance.',
            requiredSkills: ['Emergency Repair', 'Carpentry & Tools'],
            estimatedMinutes: 60,
            dependsOnTaskIds: [task1Id],
            status: 'blocked',
            blockedReason: 'Requires repair equipment mobilization first.',
            prerequisites: [
              {
                id: `prereq-${task2Id}-task1`,
                title: 'Tools & Safety Equipment Staged',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: 'Equipment must be collected from central depot.',
                targetTaskId: task1Id
              }
            ]
          },
          {
            id: task3Id,
            requestId,
            order: 3,
            title: 'Resident Safety Walkthrough & Confirmation',
            description: 'Walk through stabilized area with resident and verify habitable condition.',
            requiredSkills: [],
            estimatedMinutes: 15,
            dependsOnTaskIds: [task2Id],
            status: 'blocked',
            blockedReason: 'Pending repair completion.',
            prerequisites: [
              {
                id: `prereq-${task3Id}-task2`,
                title: 'Repairs & Stabilization Completed',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: 'Physical stabilization work must be finished.',
                targetTaskId: task2Id
              }
            ]
          }
        ];
      }

      default: {
        const task1Id = `task-${requestId}-1`;
        const task2Id = `task-${requestId}-2`;
        const task3Id = `task-${requestId}-3`;

        return [
          {
            id: task1Id,
            requestId,
            order: 1,
            title: `Stage Required Resources & Prep`,
            description: `Assemble items and prepare logistics for ${locationArea}.`,
            requiredSkills: ['Inventory Packing'],
            estimatedMinutes: 20,
            dependsOnTaskIds: [],
            requiredResourceId: primaryResource?.resourceId,
            requiredResourceQuantity: qty,
            status: 'pending',
            prerequisites: [
              {
                id: `prereq-${task1Id}-res`,
                title: 'Supply Availability',
                type: 'RESOURCE_STOCK',
                isSatisfied: false,
                details: `Requires allocation of ${qty} ${resName}.`
              }
            ]
          },
          {
            id: task2Id,
            requestId,
            order: 2,
            title: `Direct Community Aid Action in ${locationArea}`,
            description: `Coordinate on-site with recipient to deliver assistance.`,
            requiredSkills: ['Social Work', 'Vehicle Delivery'],
            estimatedMinutes: 40,
            dependsOnTaskIds: [task1Id],
            status: 'blocked',
            blockedReason: 'Staging step must complete first.',
            prerequisites: [
              {
                id: `prereq-${task2Id}-task1`,
                title: 'Staging & Preparation Finished',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: 'Step 1 must be satisfied.',
                targetTaskId: task1Id
              }
            ]
          },
          {
            id: task3Id,
            requestId,
            order: 3,
            title: 'Recipient Confirmation & Resolution Log',
            description: 'Recipient verifies satisfactory resolution of community request.',
            requiredSkills: [],
            estimatedMinutes: 10,
            dependsOnTaskIds: [task2Id],
            status: 'blocked',
            blockedReason: 'Pending action completion.',
            prerequisites: [
              {
                id: `prereq-${task3Id}-task2`,
                title: 'Community Aid Action Executed',
                type: 'TASK_PREREQUISITE',
                isSatisfied: false,
                details: 'Step 2 must finish first.',
                targetTaskId: task2Id
              }
            ]
          }
        ];
      }
    }
  },

  /**
   * Diagnoses root blockers holding a request from resolution and provides natural language explanation and remedy.
   */
  explainBlockers(
    request: CommunityRequest,
    hasResourceShortage: boolean,
    shortageDetails: string,
    uncompletedTasks: ActionTask[]
  ): BlockerAnalysis | undefined {
    if (request.recipientConfirmation?.disputed) {
      return {
        isBlocked: true,
        blockerType: 'DISPUTED',
        headline: 'Resolution Disputed by Recipient',
        explanation: `Recipient reported an issue during verification: "${request.recipientConfirmation.disputeReason || 'Service incomplete'}".`,
        affectedTaskIds: request.tasks.map((t) => t.id),
        remedy: 'Coordinator must investigate the delivery log, contact recipient, and dispatch corrective action.'
      };
    }

    if (hasResourceShortage) {
      const primaryRes = request.resourcesNeeded[0];
      const shortfall = primaryRes ? primaryRes.quantityNeeded - primaryRes.quantityAllocated : 0;
      return {
        isBlocked: true,
        blockerType: 'RESOURCE_DEFICIT',
        headline: `Resource Deficit: ${shortfall} ${primaryRes?.resourceName || 'Units'} Short`,
        explanation: `Inventory stock has 0 unallocated units for this request. Active demand community-wide exceeds current stock. ${shortageDetails}`,
        affectedTaskIds: request.tasks.filter((t) => !!t.requiredResourceId).map((t) => t.id),
        remedy: `Record inbound supply replenishment of at least ${shortfall} ${primaryRes?.resourceName || 'units'} in the Inventory Manager.`
      };
    }

    const firstBlockedTask = uncompletedTasks.find((t) => t.status === 'blocked');
    if (firstBlockedTask) {
      return {
        isBlocked: true,
        blockerType: 'PREREQUISITE_TASK',
        headline: `Waiting on Step ${firstBlockedTask.order}: "${firstBlockedTask.title}"`,
        explanation: firstBlockedTask.blockedReason || 'Prerequisite operational tasks have not completed.',
        affectedTaskIds: [firstBlockedTask.id],
        remedy: 'Advance the upstream prerequisite task to "Completed" to unlock this step.'
      };
    }

    return undefined;
  },

  /**
   * Computes the single highest-leverage next feasible action.
   */
  recommendNextFeasibleAction(
    request: CommunityRequest,
    hasResourceShortage: boolean,
    tasks: ActionTask[]
  ): NextFeasibleAction {
    if (request.recipientConfirmation?.confirmed) {
      return {
        role: 'seeker',
        actionTitle: 'Outcome Verified',
        description: 'Need is completely resolved and verified by recipient audit.',
        impact: 'Request safely closed.',
        actionType: 'confirm_receipt'
      };
    }

    if (request.status === 'awaiting_confirmation') {
      return {
        role: 'seeker',
        actionTitle: 'Confirm Outcome Receipt',
        description: `All operational tasks are finished. ${request.recipientName} must confirm whether help was received in full.`,
        impact: 'Marks request 100% resolved in community ledger.',
        actionType: 'confirm_receipt'
      };
    }

    if (hasResourceShortage) {
      const res = request.resourcesNeeded[0];
      const shortfall = res ? res.quantityNeeded - res.quantityAllocated : 1;
      return {
        role: 'coordinator',
        actionTitle: `Replenish ${shortfall} ${res?.resourceName || 'Supplies'}`,
        description: `Record supply donation of ${shortfall} units to satisfy inventory deficit.`,
        impact: `Immediately unblocks Step 1: "${tasks[0]?.title || 'Packaging'}" and allows volunteer dispatch.`,
        actionType: 'replenish_resource',
        targetResourceId: res?.resourceId
      };
    }

    const inProgressTask = tasks.find((t) => t.status === 'in_progress');
    if (inProgressTask) {
      return {
        role: 'volunteer',
        actionTitle: `Complete: "${inProgressTask.title}"`,
        description: `${inProgressTask.assignedVolunteerName || 'Assigned volunteer'} is currently executing this step. Complete it to advance the workflow.`,
        impact: `Satisfies prerequisite for Step ${inProgressTask.order + 1}.`,
        actionType: 'complete_task',
        targetTaskId: inProgressTask.id
      };
    }

    const readyTask = tasks.find((t) => t.status === 'ready');
    if (readyTask) {
      if (!readyTask.assignedVolunteerId) {
        return {
          role: 'coordinator',
          actionTitle: `Assign Volunteer to "${readyTask.title}"`,
          description: `Step ${readyTask.order} is unlocked and ready for execution. Match a volunteer based on required skills: ${readyTask.requiredSkills.join(', ') || 'General Aid'}.`,
          impact: 'Enables volunteer to begin execution immediately.',
          actionType: 'assign_volunteer',
          targetTaskId: readyTask.id
        };
      } else {
        return {
          role: 'volunteer',
          actionTitle: `Start Step ${readyTask.order}: "${readyTask.title}"`,
          description: `${readyTask.assignedVolunteerName} can now start execution.`,
          impact: 'Transitions task to In Progress.',
          actionType: 'start_task',
          targetTaskId: readyTask.id
        };
      }
    }

    return {
      role: 'coordinator',
      actionTitle: 'Review Coordination Plan',
      description: 'Review task dependency chain and ensure resources are aligned.',
      impact: 'Clarifies resolution path.',
      actionType: 'assign_volunteer'
    };
  },

  /**
   * Prevents premature completion or execution of tasks before prerequisites are satisfied.
   */
  validateTaskTransition(
    task: ActionTask,
    nextStatus: TaskStatus,
    request: CommunityRequest
  ): { allowed: boolean; reason?: string; missingPrerequisites: string[] } {
    const missingPrerequisites: string[] = [];

    // If attempting to advance to in_progress or completed
    if (nextStatus === 'in_progress' || nextStatus === 'completed') {
      // 1. Check upstream task dependencies
      if (task.dependsOnTaskIds.length > 0) {
        const prereqTasks = request.tasks.filter((t) => task.dependsOnTaskIds.includes(t.id));
        const uncompletedPrereqs = prereqTasks.filter((t) => t.status !== 'completed');
        if (uncompletedPrereqs.length > 0) {
          uncompletedPrereqs.forEach((p) => {
            missingPrerequisites.push(`Prerequisite Step ${p.order} ("${p.title}") must reach Completed status`);
          });
        }
      }

      // 2. Check resource deficit on task
      if (task.requiredResourceId) {
        const resReq = request.resourcesNeeded.find((r) => r.resourceId === task.requiredResourceId);
        if (resReq && !resReq.isSatisfied) {
          const shortfall = resReq.quantityNeeded - resReq.quantityAllocated;
          missingPrerequisites.push(`Resource shortage: ${shortfall} ${resReq.resourceName} missing from inventory`);
        }
      }

      // 3. Prevent marking completed if task was never started or assigned
      if (nextStatus === 'completed' && task.status === 'blocked') {
        missingPrerequisites.push('Task is currently locked and cannot jump directly to completed.');
      }
    }

    if (missingPrerequisites.length > 0) {
      return {
        allowed: false,
        reason: `Cannot transition task "${task.title}" to ${nextStatus.toUpperCase()}: ${missingPrerequisites.join('; ')}.`,
        missingPrerequisites
      };
    }

    return { allowed: true, missingPrerequisites: [] };
  }
};

/**
 * Re-evaluates all task states and overall request status based on:
 * 1. Resource satisfaction
 * 2. Prerequisite task completions
 * 3. Volunteer assignment
 * 4. Recipient confirmation for final resolution
 */
export function evaluateRequestState(request: CommunityRequest): CommunityRequest {
  const updatedTasks = [...request.tasks];
  const completedTaskIds = new Set(
    updatedTasks.filter((t) => t.status === 'completed').map((t) => t.id)
  );

  let hasResourceShortage = false;
  let shortageDetails = '';

  for (const req of request.resourcesNeeded) {
    if (!req.isSatisfied && req.quantityAllocated < req.quantityNeeded) {
      hasResourceShortage = true;
      const deficit = req.quantityNeeded - req.quantityAllocated;
      shortageDetails = `Resource shortage: ${deficit} ${req.resourceName} missing from inventory.`;
      break;
    }
  }

  // Evaluate each task in order
  for (let i = 0; i < updatedTasks.length; i++) {
    const task = { ...updatedTasks[i] };

    // Update prerequisite satisfaction flags
    if (task.prerequisites && task.prerequisites.length > 0) {
      task.prerequisites = task.prerequisites.map((p) => {
        let isSatisfied = p.isSatisfied;
        let unfulfilledReason: string | undefined = undefined;

        if (p.type === 'TASK_PREREQUISITE' && p.targetTaskId) {
          isSatisfied = completedTaskIds.has(p.targetTaskId);
          if (!isSatisfied) {
            unfulfilledReason = 'Step has not completed yet.';
          }
        } else if (p.type === 'RESOURCE_STOCK') {
          isSatisfied = !hasResourceShortage;
          if (!isSatisfied) {
            unfulfilledReason = shortageDetails;
          }
        } else if (p.type === 'VOLUNTEER_QUALIFICATION') {
          isSatisfied = !!task.assignedVolunteerId;
          if (!isSatisfied) {
            unfulfilledReason = 'No volunteer assigned yet.';
          }
        }

        return {
          ...p,
          isSatisfied,
          unfulfilledReason
        };
      });
    }

    // If already completed or failed, preserve
    if (task.status === 'completed' || task.status === 'failed') {
      updatedTasks[i] = task;
      continue;
    }

    // Check if task needs a resource that is not satisfied
    if (task.requiredResourceId && hasResourceShortage) {
      task.status = 'blocked';
      task.blockedReason = `CRITICAL SHORTAGE: ${shortageDetails}`;
      updatedTasks[i] = task;
      continue;
    }

    // Check if any prerequisite tasks are incomplete
    const unfulfilledDeps = task.dependsOnTaskIds.filter((depId) => !completedTaskIds.has(depId));

    if (unfulfilledDeps.length > 0) {
      const depTasks = updatedTasks.filter((t) => unfulfilledDeps.includes(t.id));
      const depTitles = depTasks.map((t) => `"${t.title}"`).join(', ');
      task.status = 'blocked';
      task.blockedReason = `Waiting on prerequisite task: ${depTitles}`;
    } else {
      // All prerequisites met and resources available!
      if (task.status === 'blocked' || task.status === 'pending') {
        task.status = 'ready';
        task.blockedReason = undefined;
      }
    }

    updatedTasks[i] = task;
  }

  // Compute Overall Request Status
  let overallStatus: RequestStatus = request.status;

  if (request.recipientConfirmation?.confirmed) {
    overallStatus = 'resolved';
  } else if (request.recipientConfirmation?.disputed) {
    overallStatus = 'blocked';
  } else {
    // Check if all operational tasks are completed
    const nonConfirmTasks = updatedTasks.filter(
      (t) =>
        !t.title.toLowerCase().includes('confirmation') &&
        !t.title.toLowerCase().includes('sign-off')
    );
    const allOperationalDone =
      nonConfirmTasks.length > 0 && nonConfirmTasks.every((t) => t.status === 'completed');

    if (allOperationalDone) {
      overallStatus = 'awaiting_confirmation';
    } else if (hasResourceShortage) {
      overallStatus = 'blocked';
    } else {
      const inProgressTask = updatedTasks.find((t) => t.status === 'in_progress');
      const readyTask = updatedTasks.find((t) => t.status === 'ready');

      if (inProgressTask) {
        overallStatus = 'in_progress';
      } else if (readyTask) {
        overallStatus = readyTask.assignedVolunteerId ? 'assigned' : 'planned';
      } else {
        const firstBlocked = updatedTasks.find((t) => t.status === 'blocked');
        overallStatus = firstBlocked ? 'blocked' : 'planned';
      }
    }
  }

  // Generate Blocker Analysis & Next Feasible Action
  const blockerAnalysis = NeedToActionEngine.explainBlockers(
    { ...request, status: overallStatus, tasks: updatedTasks },
    hasResourceShortage,
    shortageDetails,
    updatedTasks
  );

  const nextFeasibleAction = NeedToActionEngine.recommendNextFeasibleAction(
    { ...request, status: overallStatus, tasks: updatedTasks },
    hasResourceShortage,
    updatedTasks
  );

  return {
    ...request,
    tasks: updatedTasks,
    status: overallStatus,
    blockedReason: blockerAnalysis?.explanation,
    nextActionableStep: nextFeasibleAction.actionTitle,
    blockerAnalysis,
    nextFeasibleAction,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Legacy export for backwards compatibility
 */
export function generateTasksForRequest(
  requestId: string,
  category: NeedCategory,
  locationArea: string,
  resourcesNeeded: ResourceRequirement[]
): ActionTask[] {
  return NeedToActionEngine.convertNeedToTasks(requestId, category, locationArea, resourcesNeeded);
}
