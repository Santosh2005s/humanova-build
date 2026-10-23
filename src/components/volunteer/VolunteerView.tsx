import React, { useMemo, useState } from 'react';
import { ActionTask, CommunityRequest, Volunteer } from '../../types';
import { findEligibleTasksForVolunteer } from '../../services/volunteerMatcher';
import { HumanovaStore } from '../../services/store';
import { StatusBadge } from '../common/StatusBadge';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Play,
  Sparkles,
  Star,
  User,
  UserCheck
} from 'lucide-react';

interface VolunteerViewProps {
  volunteers: Volunteer[];
  requests: CommunityRequest[];
  selectedVolunteerId: string;
  onSelectVolunteer: (id: string) => void;
}

export const VolunteerView: React.FC<VolunteerViewProps> = ({
  volunteers,
  requests,
  selectedVolunteerId,
  onSelectVolunteer
}) => {
  const currentVolunteer = volunteers.find((v) => v.id === selectedVolunteerId) || volunteers[0];
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSkills, setProfileSkills] = useState<string>(currentVolunteer.skills.join(', '));
  const [profileAreas, setProfileAreas] = useState<string>(currentVolunteer.serviceAreas.join(', '));
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Find active task assigned to this volunteer
  const activeTaskDetails = useMemo(() => {
    for (const req of requests) {
      const assignedTask = req.tasks.find(
        (t) =>
          t.assignedVolunteerId === currentVolunteer.id &&
          (t.status === 'in_progress' || t.status === 'ready')
      );
      if (assignedTask) {
        return { task: assignedTask, request: req };
      }
    }
    return null;
  }, [requests, currentVolunteer.id]);

  // Find eligible community tasks ranked for this volunteer
  const eligibleMatches = findEligibleTasksForVolunteer(currentVolunteer, requests);

  const handleAcceptTask = (task: ActionTask) => {
    HumanovaStore.assignTaskVolunteer(task.id, currentVolunteer.id);
    setActionNotice(`You have accepted "${task.title}". Check your active assignment above!`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleAdvanceActiveTask = () => {
    if (!activeTaskDetails) return;
    const { task } = activeTaskDetails;

    if (task.status === 'ready') {
      const res = HumanovaStore.updateTaskStatus(task.id, 'in_progress');
      if (res.success) {
        setActionNotice(`Task "${task.title}" is now IN PROGRESS!`);
      } else {
        setActionNotice(`Premature execution blocked: ${res.reason}`);
      }
    } else if (task.status === 'in_progress') {
      const res = HumanovaStore.updateTaskStatus(task.id, 'completed');
      if (res.success) {
        setActionNotice(`Task "${task.title}" marked COMPLETED! Outcome audit stage updated.`);
      } else {
        setActionNotice(`Premature completion blocked: ${res.reason}`);
      }
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    HumanovaStore.updateVolunteer(currentVolunteer.id, {
      skills: profileSkills.split(',').map((s) => s.trim()).filter(Boolean),
      serviceAreas: profileAreas.split(',').map((s) => s.trim()).filter(Boolean)
    });
    setIsEditingProfile(false);
    setActionNotice('Volunteer profile updated! Matching engine recomputed your eligible tasks.');
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Volunteer Profile Switcher & Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={currentVolunteer.avatar}
              alt={currentVolunteer.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-teal-500 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-100">{currentVolunteer.name}</h2>
                <span className="text-xs font-mono text-amber-400 flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                  <Star className="w-3 h-3 fill-current" />
                  {currentVolunteer.rating}
                </span>
                <span className="text-xs text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40 font-mono">
                  {currentVolunteer.availabilityStatus.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>Areas: <strong className="text-slate-300">{currentVolunteer.serviceAreas.join(', ')}</strong></span>
                <span>·</span>
                <span>Completed: <strong className="text-teal-400 font-mono">{currentVolunteer.completedTasksCount}</strong> tasks</span>
              </div>
            </div>
          </div>

          {/* Quick Profile Switcher (Ideal for hackathon demo!) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Demo Persona:</span>
            <select
              value={currentVolunteer.id}
              onChange={(e) => {
                onSelectVolunteer(e.target.value);
                const nextVol = volunteers.find((v) => v.id === e.target.value);
                if (nextVol) {
                  setProfileSkills(nextVol.skills.join(', '));
                  setProfileAreas(nextVol.serviceAreas.join(', '));
                }
              }}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-lg p-2 focus:outline-none focus:border-teal-500 font-medium"
            >
              {volunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.skills[0] || 'Volunteer'})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            >
              {isEditingProfile ? 'Close Edit' : 'Edit Skills & Area'}
            </button>
          </div>
        </div>

        {/* Profile Editor Collapse */}
        {isEditingProfile && (
          <form onSubmit={handleSaveProfile} className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={profileSkills}
                  onChange={(e) => setProfileSkills(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                  placeholder="Food Handling, Vehicle Delivery, First Aid..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Service Areas (comma separated)
                </label>
                <input
                  type="text"
                  value={profileAreas}
                  onChange={(e) => setProfileAreas(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                  placeholder="Downtown District, Eastside Ward..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow cursor-pointer transition-colors"
              >
                Save Persona Changes
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Notice Banner */}
      {actionNotice && (
        <div className="bg-teal-950/80 border border-teal-800/80 rounded-xl px-4 py-3 text-xs text-teal-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Active Assignment Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
          <UserCheck className="w-4 h-4 text-teal-400" />
          My Current Active Assignment
        </h3>

        {activeTaskDetails ? (
          <div className="bg-slate-950 border border-teal-900/60 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-teal-400 bg-teal-950 px-2 py-0.5 rounded border border-teal-800/50">
                    {activeTaskDetails.request.trackingCode}
                  </span>
                  <StatusBadge status={activeTaskDetails.task.status} size="sm" />
                  <span className="text-xs font-mono text-slate-400">Step {activeTaskDetails.task.order} of {activeTaskDetails.request.tasks.length}</span>
                </div>

                <h4 className="text-base font-bold text-slate-100">{activeTaskDetails.task.title}</h4>
                <p className="text-xs text-slate-300">{activeTaskDetails.task.description}</p>

                <div className="text-xs text-slate-400 pt-1 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {activeTaskDetails.request.locationArea}
                  </span>
                  <span>·</span>
                  <span>Recipient: <strong className="text-slate-200">{activeTaskDetails.request.recipientName}</strong> ({activeTaskDetails.request.recipientContact})</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0 pt-2 sm:pt-0">
                {activeTaskDetails.task.status === 'ready' && (
                  <button
                    type="button"
                    onClick={handleAdvanceActiveTask}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Execution
                  </button>
                )}

                {activeTaskDetails.task.status === 'in_progress' && (
                  <button
                    type="button"
                    onClick={handleAdvanceActiveTask}
                    className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Delivery Step
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-950/60 border border-dashed border-slate-800 rounded-lg text-xs text-slate-400 flex items-center justify-between">
            <span>You currently have no active task underway. Browse recommended tasks below to accept one!</span>
            <span className="font-mono text-teal-400 font-semibold">Available for Dispatch</span>
          </div>
        )}
      </div>

      {/* Eligible Community Tasks with Explainable Recommendations */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Community Tasks Matched For Your Profile
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked in real-time by skill alignment, service area proximity, and dependency readiness.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {eligibleMatches.length} tasks evaluated
          </span>
        </div>

        <div className="space-y-3">
          {eligibleMatches.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-slate-800 rounded-lg">
              No matching open tasks right now.
            </div>
          ) : (
            eligibleMatches.map(({ task, request, match }) => {
              const isAssignedToMe = task.assignedVolunteerId === currentVolunteer.id;
              const isAssignedToOther = task.assignedVolunteerId && task.assignedVolunteerId !== currentVolunteer.id;
              const isBlocked = task.status === 'blocked';
              const isReady = task.status === 'ready';

              return (
                <div
                  key={`${request.id}-${task.id}`}
                  className={`p-4 rounded-xl border transition-all ${
                    isAssignedToMe
                      ? 'bg-teal-950/30 border-teal-600/60'
                      : isBlocked
                      ? 'bg-slate-950/50 border-slate-800/70 opacity-75'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-teal-400 bg-teal-950 px-2 py-0.5 rounded border border-teal-800/40">
                          {request.trackingCode}
                        </span>
                        <StatusBadge status={task.status} size="sm" />
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {request.locationArea}
                        </span>
                        <span className="text-xs font-mono text-slate-400">~{task.estimatedMinutes} mins</span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-100">{task.title}</h4>
                      <p className="text-xs text-slate-300">{task.description}</p>

                      {/* Explainable Match Reason */}
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 mt-2 flex items-start gap-2">
                        <span className="font-semibold text-teal-300 shrink-0">
                          {match.matchScore}% Compatibility:
                        </span>
                        <span className="leading-relaxed">{match.explanation}</span>
                      </div>

                      {/* Blocked notice if prerequisites aren't done */}
                      {isBlocked && task.blockedReason && (
                        <div className="text-xs text-rose-300 font-medium bg-rose-950/40 p-2 rounded border border-rose-900/50 flex items-center gap-2 mt-1">
                          <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Prerequisite lock: {task.blockedReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Score and Accept Button */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
                          match.matchScore >= 80
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : 'bg-slate-900 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {match.matchScore}% Match
                      </span>

                      {isAssignedToMe ? (
                        <span className="text-xs text-teal-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Assigned to You
                        </span>
                      ) : isAssignedToOther ? (
                        <span className="text-xs text-slate-400 font-medium">
                          Assigned to {task.assignedVolunteerName}
                        </span>
                      ) : isReady ? (
                        <button
                          type="button"
                          onClick={() => handleAcceptTask(task)}
                          className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow transition-colors cursor-pointer"
                        >
                          Accept Task
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1 rounded-lg bg-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed"
                          title="Locked until prerequisites finish"
                        >
                          Prerequisite Locked
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
