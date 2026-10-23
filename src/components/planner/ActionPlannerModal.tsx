import React, { useState } from 'react';
import { ActionTask, CommunityRequest, Volunteer } from '../../types';
import { DependencyGraph } from './DependencyGraph';
import { StatusBadge } from '../common/StatusBadge';
import { rankVolunteersForTask } from '../../services/volunteerMatcher';
import { HumanovaStore } from '../../services/store';
import {
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Sparkles,
  Star,
  UserCheck,
  X
} from 'lucide-react';

interface ActionPlannerModalProps {
  request: CommunityRequest;
  volunteers: Volunteer[];
  onClose: () => void;
  onOpenConfirmModal?: (req: CommunityRequest) => void;
  onOpenInventory?: () => void;
}

export const ActionPlannerModal: React.FC<ActionPlannerModalProps> = ({
  request,
  volunteers,
  onClose,
  onOpenConfirmModal,
  onOpenInventory
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    const initial =
      request.tasks.find((t) => t.status === 'ready' || t.status === 'in_progress') ||
      request.tasks[0];
    return initial ? initial.id : null;
  });

  const selectedTask =
    request.tasks.find((t) => t.id === selectedTaskId) ||
    request.tasks.find((t) => t.status === 'ready' || t.status === 'in_progress') ||
    request.tasks[0] ||
    null;

  const [assignmentNotice, setAssignmentNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute volunteer recommendations for selected task
  const volunteerRankings = selectedTask
    ? rankVolunteersForTask(selectedTask, request, volunteers)
    : [];

  const handleAssign = (volunteer: Volunteer) => {
    if (!selectedTask) return;
    HumanovaStore.assignTaskVolunteer(selectedTask.id, volunteer.id);
    setAssignmentNotice(`Assigned ${volunteer.name} to "${selectedTask.title}".`);
    setTimeout(() => setAssignmentNotice(null), 3500);
  };

  const handleAdvanceTask = (task: ActionTask) => {
    const nextStatus = task.status === 'ready' ? 'in_progress' : 'completed';
    const result = HumanovaStore.updateTaskStatus(task.id, nextStatus);
    if (!result.success) {
      setErrorMessage(result.reason || 'Prerequisites must finish before advancing this step.');
      setTimeout(() => setErrorMessage(null), 4500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-xs font-semibold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40">
                {request.trackingCode}
              </span>
              <StatusBadge status={request.urgency} type="urgency" size="sm" />
              <StatusBadge status={request.status} size="sm" />
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {request.locationArea}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{request.title}</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">{request.description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banners */}
        {assignmentNotice && (
          <div className="bg-teal-950/80 border-b border-teal-800/60 px-5 py-2.5 text-xs text-teal-300 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{assignmentNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-950/90 border-b border-rose-800 px-5 py-2.5 text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body: Left is Dependency Graph, Right is Volunteer Matching & Task Inspector */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Visual Action Planner Graph (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                Action Sequence & Prerequisites
              </h3>
              <span className="text-xs text-slate-400">Click a task to inspect or assign</span>
            </div>

            <DependencyGraph
              request={request}
              selectedTaskId={selectedTask?.id}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
              onQuickAssign={(task) => setSelectedTaskId(task.id)}
              onAdvanceTask={handleAdvanceTask}
              onOpenConfirmModal={onOpenConfirmModal}
              onOpenInventory={onOpenInventory}
            />

            {/* Recipient Confirmation trigger if ready */}
            {request.status === 'awaiting_confirmation' && onOpenConfirmModal && (
              <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-amber-200">All Delivery Tasks Finished!</h4>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    Requires direct recipient confirmation before this need is marked resolved.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenConfirmModal(request)}
                  className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow cursor-pointer transition-colors"
                >
                  Confirm Outcome
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Selected Task & Volunteer Matcher (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 flex flex-col">
            {selectedTask ? (
              <div className="space-y-4">
                {/* Selected Task Details with Direct Action Controls */}
                <div className="border-b border-slate-800 pb-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400">Step {selectedTask.order} Selected</span>
                    <StatusBadge status={selectedTask.status} size="sm" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 mt-1">{selectedTask.title}</h4>
                  <p className="text-xs text-slate-300 mt-1">{selectedTask.description}</p>

                  <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      ~{selectedTask.estimatedMinutes} mins
                    </span>
                    {selectedTask.assignedVolunteerName && (
                      <span className="text-teal-300 font-medium">
                        · Assigned to: {selectedTask.assignedVolunteerName}
                      </span>
                    )}
                  </div>

                  {/* Quick Task Status Controls for Coordinator */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">Execution:</span>
                    {selectedTask.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceTask(selectedTask)}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow cursor-pointer transition-colors flex items-center gap-1"
                      >
                        Start Task (Set In Progress)
                      </button>
                    )}
                    {selectedTask.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceTask(selectedTask)}
                        className="px-3 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Complete Step
                      </button>
                    )}
                    {selectedTask.status === 'completed' && (
                      <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Step Satisfied & Completed
                      </span>
                    )}
                    {selectedTask.status === 'blocked' && (
                      <span className="text-xs text-rose-300 font-medium flex items-center gap-1">
                        Prerequisite Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Volunteer Match Recommendations */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                      Ranked Volunteer Matches
                    </h5>
                    <span className="text-[11px] text-slate-400">Score & Explainable Match</span>
                  </div>

                  {selectedTask.status === 'blocked' ? (
                    <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg text-xs text-rose-300 leading-relaxed">
                      <strong>Prerequisites not met:</strong> This task is currently blocked. Volunteers can be matched now, but the task cannot execute until prerequisites clear.
                    </div>
                  ) : null}

                  <div className="space-y-2.5 mt-2 max-h-[360px] overflow-y-auto pr-1">
                    {volunteerRankings.map((match) => {
                      const isAssigned = selectedTask.assignedVolunteerId === match.volunteer.id;

                      return (
                        <div
                          key={match.volunteer.id}
                          className={`p-3 rounded-lg border transition-all ${
                            isAssigned
                              ? 'bg-teal-950/40 border-teal-500/70'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={match.volunteer.avatar}
                                alt={match.volunteer.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-700"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-200">
                                    {match.volunteer.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-amber-400 flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-current" />
                                    {match.volunteer.rating}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 block">
                                  {match.volunteer.serviceAreas.join(', ')}
                                </span>
                              </div>
                            </div>

                            {/* Match Score Badge */}
                            <div className="text-right">
                              <span
                                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                  match.matchScore >= 85
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                    : match.matchScore >= 60
                                    ? 'bg-sky-950 text-sky-300 border border-sky-800/60'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {match.matchScore}% Match
                              </span>
                            </div>
                          </div>

                          {/* Transparent Explanation */}
                          <p className="text-[11px] text-slate-300/90 mt-2 leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800/60">
                            {match.explanation}
                          </p>

                          {/* Skills badges */}
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {match.matchedSkills.map((s) => (
                              <span
                                key={s}
                                className="text-[10px] font-mono text-emerald-300 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40"
                              >
                                ✓ {s}
                              </span>
                            ))}
                            {match.missingSkills.map((s) => (
                              <span
                                key={s}
                                className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded"
                              >
                                ✕ {s}
                              </span>
                            ))}
                          </div>

                          {/* Assign button */}
                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                            <span className="text-[11px] text-slate-400">
                              Completed: <strong className="text-slate-200">{match.volunteer.completedTasksCount}</strong> tasks
                            </span>

                            {isAssigned ? (
                              <span className="text-xs text-teal-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Assigned
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAssign(match.volunteer)}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-teal-600 hover:bg-teal-500 text-white transition-colors cursor-pointer"
                              >
                                Assign Volunteer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Select a step on the left to review volunteer matches.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Current Status:{' '}
            <strong className="text-slate-200 font-mono uppercase">{request.status}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Planner
          </button>
        </div>
      </div>
    </div>
  );
};
