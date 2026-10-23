import React from 'react';
import { RequestStatus, TaskStatus, UrgencyLevel } from '../../types';
import { AlertCircle, CheckCircle2, Clock, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: RequestStatus | TaskStatus | UrgencyLevel;
  type?: 'status' | 'urgency';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'status', size = 'sm' }) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'text-xs py-0.5 px-2' : 'text-sm py-1 px-2.5';

  if (type === 'urgency') {
    switch (status) {
      case 'critical':
        return (
          <span className={`inline-flex items-center gap-1 font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded ${sizeClasses}`}>
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className={`inline-flex items-center gap-1 font-medium text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded ${sizeClasses}`}>
            <AlertCircle className="w-3 h-3 text-amber-400" />
            HIGH PRIORITY
          </span>
        );
      case 'medium':
        return (
          <span className={`inline-flex items-center gap-1 font-medium text-sky-300 bg-sky-950/40 border border-sky-800/50 rounded ${sizeClasses}`}>
            MEDIUM
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center gap-1 text-slate-400 bg-slate-900/60 border border-slate-800 rounded ${sizeClasses}`}>
            STANDARD
          </span>
        );
    }
  }

  // Request or Task Status
  switch (status) {
    case 'resolved':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-800/70 rounded ${sizeClasses}`}>
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          RESOLVED & VERIFIED
        </span>
      );
    case 'blocked':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold text-rose-400 bg-rose-950/50 border border-rose-800/70 rounded ${sizeClasses}`}>
          <AlertCircle className="w-3 h-3 text-rose-400" />
          BLOCKED ON RESOURCE/DEP
        </span>
      );
    case 'awaiting_confirmation':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold text-amber-300 bg-amber-950/50 border border-amber-700/70 rounded animate-pulse ${sizeClasses}`}>
          <Clock className="w-3 h-3 text-amber-400" />
          AWAITING RECIPIENT CONFIRMATION
        </span>
      );
    case 'in_progress':
      return (
        <span className={`inline-flex items-center gap-1 font-medium text-teal-300 bg-teal-950/50 border border-teal-800/60 rounded ${sizeClasses}`}>
          <Clock className="w-3 h-3 text-teal-400" />
          IN PROGRESS
        </span>
      );
    case 'assigned':
      return (
        <span className={`inline-flex items-center gap-1 font-medium text-cyan-300 bg-cyan-950/50 border border-cyan-800/60 rounded ${sizeClasses}`}>
          <UserCheck className="w-3 h-3 text-cyan-400" />
          VOLUNTEER ASSIGNED
        </span>
      );
    case 'ready':
      return (
        <span className={`inline-flex items-center gap-1 font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded ${sizeClasses}`}>
          READY FOR ACTION
        </span>
      );
    case 'planned':
      return (
        <span className={`inline-flex items-center gap-1 text-slate-300 bg-slate-900 border border-slate-700 rounded ${sizeClasses}`}>
          <Sparkles className="w-3 h-3 text-slate-400" />
          ACTION PLAN READY
        </span>
      );
    case 'completed':
      return (
        <span className={`inline-flex items-center gap-1 font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded ${sizeClasses}`}>
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          STEP COMPLETE
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 text-slate-400 bg-slate-900/60 border border-slate-800 rounded ${sizeClasses}`}>
          {String(status).replace('_', ' ').toUpperCase()}
        </span>
      );
  }
};
