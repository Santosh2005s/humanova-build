import React from 'react';
import { ActionTask, CommunityRequest } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  Package,
  Play,
  ShieldAlert,
  Sparkles,
  User,
  Users
} from 'lucide-react';

interface DependencyGraphProps {
  request: CommunityRequest;
  onSelectTask?: (task: ActionTask) => void;
  selectedTaskId?: string;
  onQuickAssign?: (task: ActionTask) => void;
  onAdvanceTask?: (task: ActionTask) => void;
  onOpenConfirmModal?: (req: CommunityRequest) => void;
  onOpenInventory?: () => void;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  request,
  onSelectTask,
  selectedTaskId,
  onQuickAssign,
  onAdvanceTask,
  onOpenConfirmModal,
  onOpenInventory
}) => {
  const sortedTasks = [...request.tasks].sort((a, b) => a.order - b.order);
  const blocker = request.blockerAnalysis;
  const nextAction = request.nextFeasibleAction;

  return (
    <div className="w-full space-y-4">
      {/* 1. Root Blocker Diagnostic Panel (Explains Root Blockers with Remedies) */}
      {blocker && blocker.isBlocked && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-mono text-xs font-bold uppercase text-rose-300 tracking-wider">
                Root Blocker Diagnosed · {blocker.blockerType.replace('_', ' ')}
              </span>
            </div>
            {blocker.blockerType === 'RESOURCE_DEFICIT' && onOpenInventory && (
              <button
                type="button"
                onClick={onOpenInventory}
                className="text-[11px] font-bold text-rose-200 bg-rose-900/70 hover:bg-rose-800 px-2.5 py-1 rounded border border-rose-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Package className="w-3 h-3" />
                Resolve Deficit
              </button>
            )}
          </div>

          <h4 className="text-sm font-bold text-slate-100">{blocker.headline}</h4>
          <p className="text-xs text-rose-200/90 leading-relaxed">{blocker.explanation}</p>

          <div className="pt-2 border-t border-rose-900/60 text-xs text-rose-300 font-medium flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Remedy Required: <strong>{blocker.remedy}</strong></span>
          </div>
        </div>
      )}

      {/* 2. Recommended Next Feasible Action Banner */}
      {nextAction && (
        <div className="p-3.5 bg-gradient-to-r from-teal-950/60 to-slate-900/90 border border-teal-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-teal-900/80 text-teal-300 border border-teal-700/60">
                Next Feasible Step · {nextAction.role.toUpperCase()}
              </span>
              <span className="text-[11px] text-teal-300/80 font-mono">Impact: {nextAction.impact}</span>
            </div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              {nextAction.actionTitle}
            </h4>
            <p className="text-xs text-slate-300">{nextAction.description}</p>
          </div>

          {/* Direct 1-Click Action Button for Next Feasible Move */}
          <div className="shrink-0 pt-1 sm:pt-0">
            {nextAction.actionType === 'confirm_receipt' && onOpenConfirmModal && (
              <button
                type="button"
                onClick={() => onOpenConfirmModal(request)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-colors cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Audit Outcome
              </button>
            )}

            {nextAction.actionType === 'replenish_resource' && onOpenInventory && (
              <button
                type="button"
                onClick={onOpenInventory}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow transition-colors cursor-pointer flex items-center gap-1"
              >
                <Package className="w-3.5 h-3.5" />
                Replenish Supply
              </button>
            )}

            {nextAction.actionType === 'start_task' && nextAction.targetTaskId && onAdvanceTask && (
              <button
                type="button"
                onClick={() => {
                  const target = sortedTasks.find((t) => t.id === nextAction.targetTaskId);
                  if (target) onAdvanceTask(target);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-colors cursor-pointer flex items-center gap-1"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Step
              </button>
            )}

            {nextAction.actionType === 'complete_task' && nextAction.targetTaskId && onAdvanceTask && (
              <button
                type="button"
                onClick={() => {
                  const target = sortedTasks.find((t) => t.id === nextAction.targetTaskId);
                  if (target) onAdvanceTask(target);
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow transition-colors cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Complete Step
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Visual Workflow Timeline with Prerequisite Graphs */}
      <div className="relative space-y-4 pt-1">
        {sortedTasks.map((task, index) => {
          const isSelected = selectedTaskId === task.id;
          const isCompleted = task.status === 'completed';
          const isBlocked = task.status === 'blocked';
          const isReady = task.status === 'ready';
          const isInProgress = task.status === 'in_progress';

          // Prerequisite tasks
          const prerequisiteTasks = sortedTasks.filter((t) => task.dependsOnTaskIds.includes(t.id));
          const hasPrereqs = prerequisiteTasks.length > 0;
          const detailedPrereqs = task.prerequisites || [];

          return (
            <div key={task.id} className="relative">
              {/* Connector line to next step in workflow */}
              {index < sortedTasks.length - 1 && (
                <div
                  className={`absolute left-6 top-12 bottom--4 w-0.5 z-0 transition-colors ${
                    isCompleted ? 'bg-emerald-500/50' : 'bg-slate-800'
                  }`}
                  style={{ height: 'calc(100% + 16px)' }}
                />
              )}

              <div
                onClick={() => onSelectTask && onSelectTask(task)}
                className={`relative z-10 transition-all cursor-pointer rounded-lg border p-4 ${
                  isSelected
                    ? 'bg-slate-800/95 border-teal-500 ring-1 ring-teal-500/50 shadow-lg'
                    : isBlocked
                    ? 'bg-slate-900/70 border-rose-900/40 hover:border-rose-800/70'
                    : isReady
                    ? 'bg-slate-900/90 border-emerald-900/50 hover:border-emerald-700/60'
                    : isCompleted
                    ? 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 opacity-90'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Order badge & Title */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : isBlocked
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : isReady
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 ring-2 ring-teal-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isBlocked ? (
                        <Lock className="w-4 h-4 text-rose-400" />
                      ) : (
                        task.order
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100 text-sm">{task.title}</span>
                        <StatusBadge status={task.status} size="sm" />
                        <span className="text-xs font-mono text-slate-400">~{task.estimatedMinutes} min</span>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">{task.description}</p>

                      {/* Required Skills & Resource Tags */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {task.requiredSkills.map((skill) => (
                          <span
                            key={skill}
                            className="text-[11px] font-mono text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700"
                          >
                            Skill: {skill}
                          </span>
                        ))}

                        {task.requiredResourceQuantity && (
                          <span className="text-[11px] font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                            Supply: {task.requiredResourceQuantity} units required
                          </span>
                        )}
                      </div>

                      {/* Detailed Prerequisite Checklist */}
                      {detailedPrereqs.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/70 space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                            Prerequisite Checklist:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {detailedPrereqs.map((prereq) => (
                              <div
                                key={prereq.id}
                                className={`text-[11px] px-2 py-1 rounded flex items-start gap-1.5 font-mono ${
                                  prereq.isSatisfied
                                    ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-900/40'
                                    : 'bg-rose-950/40 text-rose-300 border border-rose-900/50'
                                }`}
                              >
                                {prereq.isSatisfied ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                )}
                                <div className="leading-tight">
                                  <span className="font-semibold">{prereq.title}</span>
                                  {!prereq.isSatisfied && prereq.unfulfilledReason && (
                                    <span className="block text-[10px] text-rose-400 mt-0.5">
                                      {prereq.unfulfilledReason}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Legacy Prerequisite Tags if detailed not loaded */}
                      {detailedPrereqs.length === 0 && hasPrereqs && (
                        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500">Prerequisite:</span>
                          {prerequisiteTasks.map((prereq) => (
                            <span
                              key={prereq.id}
                              className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                                prereq.status === 'completed'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800/50'
                              }`}
                            >
                              Step {prereq.order}: {prereq.status === 'completed' ? '✓ Satisfied' : 'Pending'}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Explicit Blocked Reason */}
                      {isBlocked && task.blockedReason && (
                        <div className="mt-2 text-xs text-rose-300 font-medium bg-rose-950/50 border border-rose-900/60 p-2 rounded flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                          <span>Locked: {task.blockedReason}</span>
                        </div>
                      )}

                      {/* Assigned Volunteer Badge */}
                      {task.assignedVolunteerName && (
                        <div className="mt-2 text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-1 rounded inline-flex items-center gap-1.5">
                          <User className="w-3 h-3 text-cyan-400" />
                          <span>Assigned Volunteer: <strong className="text-slate-100">{task.assignedVolunteerName}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions & Premature Completion Guards */}
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    {isReady && !task.assignedVolunteerId && onQuickAssign && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAssign(task);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Match Volunteer
                      </button>
                    )}

                    {isReady && onAdvanceTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdvanceTask(task);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Start Task
                      </button>
                    )}

                    {isInProgress && onAdvanceTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdvanceTask(task);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-sm transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Complete Step
                      </button>
                    )}

                    {/* Premature Completion Guard: Disabled Lock for Blocked Tasks */}
                    {isBlocked && (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-slate-950/80 border border-slate-800 text-slate-500 cursor-not-allowed"
                        title={task.blockedReason || 'Prerequisites must finish before starting'}
                      >
                        <Lock className="w-3 h-3 text-rose-500/70" />
                        Prerequisite Locked
                      </button>
                    )}

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 font-semibold px-2 py-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Finished
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
