import React, { useMemo, useState } from 'react';
import { CommunityRequest, NeedCategory, UrgencyLevel } from '../../types';
import { parseIntakeRuleBased, parseWithGeminiIfAvailable } from '../../services/aiIntakeParser';
import { HumanovaStore } from '../../services/store';
import { StatusBadge } from '../common/StatusBadge';
import { RecipientConfirmModal } from './RecipientConfirmModal';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  MapPin,
  Send,
  Sparkles,
  UserCheck
} from 'lucide-react';

interface SeekerViewProps {
  requests: CommunityRequest[];
  onOpenPlanner?: (req: CommunityRequest) => void;
}

export const SeekerView: React.FC<SeekerViewProps> = ({ requests, onOpenPlanner }) => {
  // Form State
  const [description, setDescription] = useState<string>('');
  const [locationArea, setLocationArea] = useState<string>('Downtown District');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientContact, setRecipientContact] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [createdRequest, setCreatedRequest] = useState<CommunityRequest | null>(null);
  const [confirmingRequestId, setConfirmingRequestId] = useState<string | null>(null);

  const confirmingRequest = requests.find((r) => r.id === confirmingRequestId) || null;

  // Real-time Parser Preview
  const parsedPreview = useMemo(() => {
    if (!description.trim()) return null;
    return parseIntakeRuleBased(description, locationArea);
  }, [description, locationArea]);

  // Handle Preset Quick Prompts for fast Hackathon Testing
  const handleQuickPrompt = (promptText: string, area: string, name: string, contact: string) => {
    setDescription(promptText);
    setLocationArea(area);
    setRecipientName(name);
    setRecipientContact(contact);
  };

  const handleAiEnrich = async () => {
    if (!description.trim()) return;
    setIsAiAnalyzing(true);
    try {
      const result = await parseWithGeminiIfAvailable(description, locationArea);
      // If AI detected better location or title
      if (result.locationArea) setLocationArea(result.locationArea);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !recipientName.trim()) return;

    setIsSubmitting(true);
    const parsed = parseIntakeRuleBased(description, locationArea);

    const newReq = HumanovaStore.createRequest({
      title: parsed.title,
      description,
      category: parsed.category,
      urgency: parsed.urgency,
      locationArea,
      recipientName,
      recipientContact: recipientContact || 'Self-reported via Portal',
      quantityNeeded: parsed.quantityNeeded,
      resourceName: parsed.resourceName,
      unit: parsed.unit
    });

    setCreatedRequest(newReq);
    setDescription('');
    setRecipientName('');
    setRecipientContact('');
    setIsSubmitting(false);

    setTimeout(() => {
      setCreatedRequest(null);
    }, 8000);
  };

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {createdRequest && (
        <div className="bg-emerald-950/70 border border-emerald-700/80 rounded-xl p-4 text-xs text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-100">Request Registered!</span> Tracking Code:{' '}
              <strong className="font-mono text-emerald-300 text-sm bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700/50">
                {createdRequest.trackingCode}
              </strong>
              . Action planner decomposed your need into {createdRequest.tasks.length} verifiable steps.
            </div>
          </div>

          {onOpenPlanner && (
            <button
              type="button"
              onClick={() => onOpenPlanner(createdRequest)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Inspect Action Plan
            </button>
          )}
        </div>
      )}

      {/* Grid: Request Submission Form (Left) & Live Intake Intelligence Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Request Form (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div>
            <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40">
              COMMUNITY NEED INTAKE
            </span>
            <h2 className="text-base font-bold text-slate-100 mt-1">Submit a Mutual Aid or Crisis Assistance Request</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Describe what is needed in natural language. Humanova analyzes dependencies, identifies missing supplies, and creates an executable action plan.
            </p>
          </div>

          {/* Quick Presets for Demo */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Quick Hackathon Presets:
            </span>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt(
                    'Need 15 prepared nutritious lunch meals for low-income seniors at Pineview Center today.',
                    'Downtown District',
                    'Pineview Heights Senior Hub',
                    'coordinator@pineview.org | 555-019-2831'
                  )
                }
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                15 Senior Lunches
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt(
                    'Emergency delivery needed for blood pressure medication and basic wellness check.',
                    'Downtown District',
                    'Harold Miller (Apt 302)',
                    '555-891-2309'
                  )
                }
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Medication Delivery
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt(
                    'Severe storm damage blew off tarp on family roof, urgent weatherproofing needed.',
                    'Eastside Ward',
                    'Rosa Martinez',
                    '555-332-9011'
                  )
                }
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Storm Roof Tarp
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  What help is needed? (Describe items, quantity, urgency)
                </label>
                <button
                  type="button"
                  onClick={handleAiEnrich}
                  disabled={isAiAnalyzing || !description.trim()}
                  className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  {isAiAnalyzing ? 'Analyzing with AI...' : 'Analyze with AI'}
                </button>
              </div>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. We urgently need 8 warm dinners for a displaced family with small children currently staying at Hope Haven Shelter..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Service Area / Ward</label>
                <select
                  value={locationArea}
                  onChange={(e) => setLocationArea(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="Downtown District">Downtown District</option>
                  <option value="Eastside Ward">Eastside Ward</option>
                  <option value="North Hills">North Hills</option>
                  <option value="West End">West End</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Recipient / Org Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Sister Maria Gomez"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contact Phone or Email</label>
                <input
                  type="text"
                  value={recipientContact}
                  onChange={(e) => setRecipientContact(e.target.value)}
                  placeholder="e.g. 555-442-1980"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !description.trim() || !recipientName.trim()}
              className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Need & Generate Dependency Action Plan
            </button>
          </form>
        </div>

        {/* Right: Real-time Rule-based Intake Parser Inspection (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                Intake Engine Extraction
              </h3>
              <span className="text-[10px] font-mono text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40">
                Rule-Based + AI Layer
              </span>
            </div>

            {parsedPreview ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Detected Category</span>
                    <span className="text-xs font-bold text-teal-300 uppercase font-mono">
                      {parsedPreview.category.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Assessed Urgency</span>
                    <StatusBadge status={parsedPreview.urgency} type="urgency" size="sm" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Extracted Supply & Quantity</span>
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {parsedPreview.quantityNeeded} {parsedPreview.unit} ({parsedPreview.resourceName})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Service Area</span>
                    <span className="text-xs text-slate-300">{parsedPreview.locationArea}</span>
                  </div>
                </div>

                {/* Identified Skills Needed */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Required Volunteer Skills:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {parsedPreview.identifiedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[11px] font-mono text-teal-300 bg-teal-950/50 px-2 py-0.5 rounded border border-teal-800/50"
                      >
                        ✓ {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Missing Information Checks */}
                {parsedPreview.missingInformation.length > 0 && (
                  <div className="p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-lg">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Missing Information Identified:
                    </div>
                    <ul className="text-[11px] text-amber-200/80 space-y-0.5 pl-4 list-disc">
                      {parsedPreview.missingInformation.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 border border-slate-800/60 rounded-lg">
                Type in the request field on the left or select a preset to see the live intake parser structure the need in real-time.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Deterministic rule parser runs instantly offline. AI enrichment operates optionally if Gemini key is present.</span>
          </div>
        </div>
      </div>

      {/* Community Requests Tracker & Recipient Confirmation Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              Live Request Progression & Outcome Verification
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Follow submitted needs through dispatch, delivery, and direct recipient outcome sign-off.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">{requests.length} total community requests</span>
        </div>

        <div className="space-y-3">
          {requests.map((req) => {
            const isAwaitingConfirm = req.status === 'awaiting_confirmation';
            const isResolved = req.status === 'resolved';
            const isBlocked = req.status === 'blocked';

            return (
              <div
                key={req.id}
                className={`p-4 rounded-xl border transition-all ${
                  isAwaitingConfirm
                    ? 'bg-amber-950/20 border-amber-600/70 shadow-lg ring-1 ring-amber-500/30'
                    : isResolved
                    ? 'bg-slate-950/50 border-emerald-900/40 opacity-90'
                    : isBlocked
                    ? 'bg-slate-950/60 border-rose-900/50'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-teal-400 bg-teal-950 px-2 py-0.5 rounded border border-teal-800/40">
                        {req.trackingCode}
                      </span>
                      <StatusBadge status={req.status} size="sm" />
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {req.locationArea}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100">{req.title}</h4>
                    <p className="text-xs text-slate-300">{req.description}</p>

                    <div className="text-xs text-slate-400 pt-1 flex items-center gap-2 flex-wrap">
                      <span>Recipient: <strong className="text-slate-200">{req.recipientName}</strong></span>
                      <span>·</span>
                      <span>Next Action: <strong className="text-teal-300">{req.nextActionableStep || 'Ongoing'}</strong></span>
                    </div>

                    {/* Recipient Confirmation Details if already signed */}
                    {req.recipientConfirmation && (
                      <div className="mt-2.5 p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Recipient Confirmation Recorded ({new Date(req.recipientConfirmation.confirmedAt || '').toLocaleTimeString()}):</span>
                        </div>
                        <p className="text-slate-300 mt-1 italic pl-6">
                          "{req.recipientConfirmation.feedback || 'Help verified as received.'}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Action: Recipient Confirmation Trigger */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 pt-2 md:pt-0">
                    {isAwaitingConfirm ? (
                      <button
                        type="button"
                        onClick={() => setConfirmingRequestId(req.id)}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5 animate-pulse"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm Help Received
                      </button>
                    ) : isResolved ? (
                      <span className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Outcome Verified
                      </span>
                    ) : onOpenPlanner ? (
                      <button
                        type="button"
                        onClick={() => onOpenPlanner(req)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 cursor-pointer"
                      >
                        View Action Graph
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recipient Confirm Modal */}
      {confirmingRequest && (
        <RecipientConfirmModal
          request={confirmingRequest}
          onClose={() => setConfirmingRequestId(null)}
        />
      )}
    </div>
  );
};
