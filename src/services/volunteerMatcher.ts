import { ActionTask, CommunityRequest, Volunteer, VolunteerMatch } from '../types';

/**
 * Matches and ranks volunteers for a specific action task and community request.
 * Explains the exact scoring breakdown (skills, service area, availability).
 */
export function rankVolunteersForTask(
  task: ActionTask,
  request: CommunityRequest,
  volunteers: Volunteer[]
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
      (area) =>
        requestArea.includes(area.toLowerCase()) ||
        area.toLowerCase().includes(requestArea) ||
        area.toLowerCase() === 'all wards'
    );
    const areaScore = matchesArea ? 100 : 35; // Partial score for city-wide

    // 3. Availability & Workload evaluation (20% weight)
    let availabilityScore = 0;
    if (vol.availabilityStatus === 'available') {
      availabilityScore = vol.currentAssignedTaskId ? 70 : 100;
    } else if (vol.availabilityStatus === 'busy') {
      availabilityScore = 30;
    } else {
      availabilityScore = 0;
    }

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

    if (vol.availabilityStatus === 'available') {
      if (!vol.currentAssignedTaskId) {
        reasons.push('Available immediately with no active task bottleneck');
      } else {
        reasons.push('Available today (1 ongoing task active)');
      }
    } else {
      reasons.push(`Status is currently ${vol.availabilityStatus}`);
    }

    const explanation = reasons.join(' · ');
    const isEligible = skillScore >= 50 && vol.availabilityStatus !== 'offline';

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
      const matches = rankVolunteersForTask(task, req, [volunteer]);
      const match = matches[0];

      if (match) {
        eligibleTasks.push({
          task,
          request: req,
          match
        });
      }
    });
  });

  // Sort by match score descending, placing ready/unassigned tasks first
  return eligibleTasks.sort((a, b) => {
    // If one is ready and unassigned, prioritize it
    const aIsPriority = a.task.status === 'ready' && !a.task.assignedVolunteerId;
    const bIsPriority = b.task.status === 'ready' && !b.task.assignedVolunteerId;
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;

    return b.match.matchScore - a.match.matchScore;
  });
}
