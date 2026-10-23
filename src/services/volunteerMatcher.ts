import { ActionTask, CommunityRequest, Volunteer, VolunteerMatch } from '../types';

/**
 * Matches and ranks volunteers for a specific action task and community request.
 * Explains the exact scoring breakdown (skills, service area, availability).
 */
export function rankVolunteersForTask(
  task: ActionTask,
  request: CommunityRequest,
  volunteers: Volunteer[],
  allRequests: CommunityRequest[] = [request]
): VolunteerMatch[] {
  const matches: VolunteerMatch[] = volunteers.map((vol) => {
    // 1. Skill evaluation (50% weight)
    const requiredSkills = task.requiredSkills || [];
    let matchedSkills: string[] = [];
    let missingSkills: string[] = [];
    let skillScore = 100;

    if (requiredSkills.length > 0) {
      matchedSkills = requiredSkills.filter((reqSkill) =>
        vol.skills.some((vs) => vs.toLowerCase() === reqSkill.toLowerCase())
      );
      missingSkills = requiredSkills.filter(
        (reqSkill) => !vol.skills.some((vs) => vs.toLowerCase() === reqSkill.toLowerCase())
      );
      skillScore = Math.round((matchedSkills.length / requiredSkills.length) * 100);
    } else {
      matchedSkills = ['General Assistance'];
    }

    // 2. Service Area evaluation (30% weight)
    const requestArea = request.locationArea.toLowerCase();
    const matchesArea = vol.serviceAreas.some(
      (area) => area.trim().toLowerCase() === requestArea || area.trim().toLowerCase() === 'all wards'
    );
    const areaScore = matchesArea ? 100 : 0;

    const hasOtherActiveTask = Boolean(
      (vol.currentAssignedTaskId && vol.currentAssignedTaskId !== task.id) ||
      allRequests.some((candidateRequest) =>
        candidateRequest.tasks.some(
          (assignedTask) =>
            assignedTask.id !== task.id &&
            assignedTask.assignedVolunteerId === vol.id &&
            (assignedTask.status === 'ready' || assignedTask.status === 'in_progress')
        )
      )
    );
    const assignedToAnotherVolunteer = Boolean(
      task.assignedVolunteerId && task.assignedVolunteerId !== vol.id
    );

    // 3. Availability & Workload evaluation (20% weight)
    let availabilityScore = 0;
    availabilityScore =
      vol.availabilityStatus === 'available' && !hasOtherActiveTask ? 100 : 0;

    // Overall weighted score
    const totalScore = Math.round(
      skillScore * 0.5 + areaScore * 0.3 + availabilityScore * 0.2
    );

    // Human-readable explanation
    const reasons: string[] = [];
    if (requiredSkills.length > 0) {
      if (missingSkills.length === 0) {
        reasons.push(`Possesses required skills: ${matchedSkills.join(', ')}`);
      } else if (matchedSkills.length > 0) {
        reasons.push(`Has ${matchedSkills.join(', ')} (needs ${missingSkills.join(', ')})`);
      } else {
        reasons.push(`Lacks required skills (${missingSkills.join(', ')})`);
      }
    } else {
      reasons.push('General community aid task (no specialty credential required)');
    }

    if (matchesArea) {
      reasons.push(`Regularly serves ${request.locationArea}`);
    } else {
      reasons.push(`Outside primary area (covers: ${vol.serviceAreas.join(', ')})`);
    }

    if (vol.availabilityStatus === 'available' && !hasOtherActiveTask) {
      reasons.push('Available immediately with no active task bottleneck');
    } else {
      reasons.push(`Status is currently ${vol.availabilityStatus}`);
    }

    if (hasOtherActiveTask) reasons.push('Already assigned to another active task');
    if (assignedToAnotherVolunteer) reasons.push(`Task assigned to ${task.assignedVolunteerName || 'another volunteer'}`);
    if (!vol.verified) reasons.push('Volunteer profile is not verified');
    if (task.status === 'blocked') reasons.push('Task is blocked until its prerequisites are met');
    if (task.status === 'completed' || task.status === 'failed') reasons.push(`Task is ${task.status}`);

    const explanation = reasons.join(' · ');
    const isEligible =
      missingSkills.length === 0 &&
      matchesArea &&
      vol.availabilityStatus === 'available' &&
      vol.verified &&
      !hasOtherActiveTask &&
      !assignedToAnotherVolunteer &&
      task.status !== 'completed' &&
      task.status !== 'failed';

    return {
      volunteer: vol,
      matchScore: totalScore,
      breakdown: {
        skillScore,
        areaScore,
        availabilityScore
      },
      matchedSkills,
      missingSkills,
      explanation,
      isEligible
    };
  });

  // Sort descending by matchScore
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Finds all community tasks eligible for a specific volunteer, ranked by compatibility.
 */
export function findEligibleTasksForVolunteer(
  volunteer: Volunteer,
  requests: CommunityRequest[]
): Array<{
  task: ActionTask;
  request: CommunityRequest;
  match: VolunteerMatch;
}> {
  const eligibleTasks: Array<{
    task: ActionTask;
    request: CommunityRequest;
    match: VolunteerMatch;
  }> = [];

  requests.forEach((req) => {
    if (req.status === 'resolved' || req.status === 'cancelled') return;

    req.tasks.forEach((task) => {
      // Evaluate match for this volunteer
      const matches = rankVolunteersForTask(task, req, [volunteer], requests);
      const match = matches[0];

      if (match?.isEligible) {
        eligibleTasks.push({
          task,
          request: req,
          match
        });
      }
    });
  });

  const urgencyWeight: Record<CommunityRequest['urgency'], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  // Keep task readiness first, then urgency and age, with compatibility as a tie-breaker.
  return eligibleTasks.sort((a, b) => {
    const aIsPriority = a.task.status === 'ready' && !a.task.assignedVolunteerId;
    const bIsPriority = b.task.status === 'ready' && !b.task.assignedVolunteerId;
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;

    const urgencyDiff = urgencyWeight[b.request.urgency] - urgencyWeight[a.request.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    const ageDiff = new Date(a.request.createdAt).getTime() - new Date(b.request.createdAt).getTime();
    if (ageDiff !== 0) return ageDiff;

    return b.match.matchScore - a.match.matchScore;
  });
}
