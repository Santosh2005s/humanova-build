import React, { useState } from 'react';
import { CommunityRequest } from '../../types';
import { HumanovaStore } from '../../services/store';
import { AlertCircle, CheckCircle2, MessageSquare, Star, ThumbsDown, ThumbsUp, X } from 'lucide-react';

interface RecipientConfirmModalProps {
  request: CommunityRequest;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RecipientConfirmModal: React.FC<RecipientConfirmModalProps> = ({
  request,
  onClose,
  onSuccess
}) => {
  const [decision, setDecision] = useState<'confirm' | 'dispute'>('confirm');
  const [rating, setRating] = useState<number>(5);
  const [feedback, setFeedback] = useState<string>('All items arrived promptly and in great condition. Thank you so much!');
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (decision === 'confirm') {
        await HumanovaStore.submitRecipientConfirmation(
          request.id,
          true,
          `${feedback} (Rating: ${rating}/5)`
        );
      } else {
        await HumanovaStore.submitRecipientConfirmation(
          request.id,
          false,
          undefined,
          disputeReason || 'Recipient stated delivery was incomplete or not received.'
        );
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      setSubmitError(HumanovaStore.getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/90">
          <div>
            <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40">
              AUDIT VERIFICATION · {request.trackingCode}
            </span>
            <h2 className="text-base font-bold text-slate-100 mt-1">Recipient Outcome Confirmation</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Confirming direct resolution for: <strong className="text-slate-100">{request.recipientName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300">
            <span className="font-semibold text-slate-200">Rule of Outcome:</span> A community request is never marked <span className="text-emerald-400 font-mono">RESOLVED</span> upon volunteer dispatch or delivery completion alone. Direct recipient or authorized on-site confirmation is required.
          </div>

          {/* Toggle: Confirm or Dispute */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Did the recipient receive the requested assistance?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecision('confirm')}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  decision === 'confirm'
                    ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 shrink-0 mt-0.5 ${decision === 'confirm' ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div>
                  <div className="font-bold text-xs text-slate-200">Yes, Help Received</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Satisfactorily delivered in full</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('dispute')}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  decision === 'dispute'
                    ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500/50 text-rose-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ThumbsDown className={`w-4 h-4 shrink-0 mt-0.5 ${decision === 'dispute' ? 'text-rose-400' : 'text-slate-500'}`} />
                <div>
                  <div className="font-bold text-xs text-slate-200">Issue / Dispute</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Missing items or not received</div>
                </div>
              </button>
            </div>
          </div>

          {decision === 'confirm' ? (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Recipient Satisfaction Rating
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        rating >= star ? 'text-amber-400' : 'text-slate-600 hover:text-slate-500'
                      }`}
                    >
                      <Star className="w-5 h-5 fill-current" />
                    </button>
                  ))}
                  <span className="text-xs font-mono text-slate-400 ml-2">{rating} of 5 Stars</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  Recipient or Coordinator Verification Note
                </label>
                <textarea
                  rows={2}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  placeholder="Note on meal condition, temperature, or recipient comments..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>
                  Disputing this request will immediately mark it <strong>BLOCKED</strong> and alert coordinators to investigate.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Dispute Reason / Explanation
                </label>
                <textarea
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full bg-slate-950 border border-rose-900/50 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  placeholder="Describe what occurred (e.g. wrong address, damaged items, short delivery)..."
                  required
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          {submitError && (
            <div role="alert" className="text-xs text-rose-200 bg-rose-950/50 border border-rose-800 rounded p-2">
              Outcome was not saved: {submitError}
            </div>
          )}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer transition-colors ${
                decision === 'confirm'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {isSubmitting ? 'Saving...' : decision === 'confirm' ? 'Confirm Resolution' : 'Submit Dispute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
