import React, { useState } from 'react';
import { HumanovaStore } from '../../services/store';
import { CommunityResourceMetrics } from '../../services/resourceEngine';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Play,
  RotateCcw,
  Sparkles,
  Users
} from 'lucide-react';

interface DemoScenarioBannerProps {
  metrics: CommunityResourceMetrics;
  onNavigateToTab: (tab: 'coordinator' | 'volunteer' | 'seeker') => void;
  onSelectVolunteer: (volId: string) => void;
  onOpenPlanner?: (reqId: string) => void;
}

export const DemoScenarioBanner: React.FC<DemoScenarioBannerProps> = ({
  metrics,
  onNavigateToTab,
  onSelectVolunteer,
  onOpenPlanner
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeStep, setActiveStep] = useState<number>(1);

  const mealSummary = metrics.resourcesSummary.find((s) => s.resource.id === 'res-meals');
  const mealShortage = mealSummary?.shortageDeficit || 0;

  const handleStep1 = () => {
    setActiveStep(1);
    onNavigateToTab('coordinator');
  };

  const handleStep2 = () => {
    setActiveStep(2);
    onNavigateToTab('coordinator');
    if (onOpenPlanner) onOpenPlanner('req-family-shelter');
  };

  const handleStep3Replenish = () => {
    setActiveStep(3);
    HumanovaStore.replenishResource('res-meals', 10);
    onNavigateToTab('coordinator');
  };

  const handleStep4AssignElena = () => {
    setActiveStep(4);
    // Ensure 10 meals replenished so task isn't starved, then assign Elena
    HumanovaStore.assignTaskVolunteer('task-fs-1', 'vol-1');
    onNavigateToTab('coordinator');
    if (onOpenPlanner) onOpenPlanner('req-family-shelter');
  };

  const handleStep5SwitchVolunteer = () => {
    setActiveStep(5);
    onSelectVolunteer('vol-1');
    onNavigateToTab('volunteer');
  };

  const handleStep6ConfirmOutcome = () => {
    setActiveStep(6);
    // Ensure at least one request has finished operational tasks so recipient confirmation can be demonstrated
    const state = HumanovaStore.getState();
    const hasAwaiting = state.requests.some((r) => r.status === 'awaiting_confirmation');
    if (!hasAwaiting) {
      HumanovaStore.updateTaskStatus('task-el-2', 'completed');
      HumanovaStore.updateTaskStatus('task-el-3', 'completed');
    }
    onNavigateToTab('seeker');
  };

  const handleReset = () => {
    HumanovaStore.resetToDemoScenario();
    setActiveStep(1);
    onNavigateToTab('coordinator');
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border-b border-teal-900/60 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Left Title and Status summary */}
          <div className="flex items-center gap-3">
            <span className="p-1 bg-teal-500/10 border border-teal-500/30 rounded text-teal-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              LIVE HACKATHON SCENARIO
            </span>
            <div className="text-xs text-slate-300 hidden sm:flex items-center gap-2">
              <span>Community Meal Demand: <strong className="text-slate-100 font-mono">20 Meals</strong></span>
              <span>·</span>
              <span>Pantry Stock: <strong className="text-slate-100 font-mono">{mealSummary?.resource.totalAvailable || 12} Meals</strong></span>
              <span>·</span>
              {mealShortage > 0 ? (
                <span className="text-rose-400 font-bold font-mono bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                  Deficit: -{mealShortage} Meals
                </span>
              ) : (
                <span className="text-emerald-400 font-bold font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  Deficit Resolved (Adequate Stock)
                </span>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 font-mono"
              title="Reset state to initial 20 meal requests vs 12 available stock"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              Reset Demo
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-teal-400 hover:text-teal-300 px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 font-medium"
            >
              <span>{isExpanded ? 'Hide Tour' : 'Show 6-Step Tour'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Step-by-Step Flow Ribbon */}
        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/70">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* Step 1 */}
              <button
                type="button"
                onClick={handleStep1}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  activeStep === 1
                    ? 'bg-teal-950/60 border-teal-500 text-teal-200 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
                  <span>STEP 1</span>
                  {mealShortage > 0 && <span className="text-rose-400">8 Deficit</span>}
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-0.5 line-clamp-1">
                  Examine Shortage
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  See blocked shelter request
                </div>
              </button>

              {/* Step 2 */}
              <button
                type="button"
                onClick={handleStep2}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  activeStep === 2
                    ? 'bg-teal-950/60 border-teal-500 text-teal-200 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] font-mono font-bold text-slate-400">
                  <span>STEP 2</span>
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-0.5 line-clamp-1">
                  Dependency Planner
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  Inspect task prerequisite locks
                </div>
              </button>

              {/* Step 3 */}
              <button
                type="button"
                onClick={handleStep3Replenish}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  activeStep === 3
                    ? 'bg-teal-950/60 border-teal-500 text-teal-200 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
                  <span>STEP 3</span>
                  <span className="text-emerald-400 font-bold">+10 Meals</span>
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-0.5 line-clamp-1">
                  Replenish Stock
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  1-Click unblocks shelter request
                </div>
              </button>

              {/* Step 4 */}
              <button
                type="button"
                onClick={handleStep4AssignElena}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  activeStep === 4
                    ? 'bg-teal-950/60 border-teal-500 text-teal-200 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] font-mono font-bold text-slate-400">
                  <span>STEP 4</span>
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-0.5 line-clamp-1">
                  Volunteer Matching
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  Elena (95% Match) assigned
                </div>
              </button>

              {/* Step 5 */}
              <button
                type="button"
                onClick={handleStep5SwitchVolunteer}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  activeStep === 5
                    ? 'bg-teal-950/60 border-teal-500 text-teal-200 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] font-mono font-bold text-slate-400">
                  <span>STEP 5</span>
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-0.5 line-clamp-1">
                  Volunteer Execution
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  Elena executes delivery
                </div>
              </button>

              {/* Step 6 */}
              <button
                type="button"
                onClick={handleStep6ConfirmOutcome}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  activeStep === 6
                    ? 'bg-teal-950/60 border-teal-500 text-teal-200 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] font-mono font-bold text-slate-400">
                  <span>STEP 6</span>
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-0.5 line-clamp-1">
                  Outcome Audit
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  Recipient confirms & resolves
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
