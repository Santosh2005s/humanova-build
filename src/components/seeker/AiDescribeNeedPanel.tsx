import React, { useState, useEffect } from 'react';
import {
  AiAnalyzedNeed,
  CommunityRequest,
  NeedCategory,
  UrgencyLevel
} from '../../types';
import {
  analyzeNeedWithGeminiServer,
  checkGeminiServerStatus
} from '../../services/aiIntakeParser';
import { HumanovaStore } from '../../services/store';
import { StatusBadge } from '../common/StatusBadge';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Cpu,
  Edit3,
  HelpCircle,
  KeyRound,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface AiDescribeNeedPanelProps {
  onRequestCreated: (req: CommunityRequest) => void;
  onSwitchToManual: () => void;
}

export const AiDescribeNeedPanel: React.FC<AiDescribeNeedPanelProps> = ({
  onRequestCreated,
  onSwitchToManual
}) => {
  // Input State
  const [description, setDescription] = useState<string>('');
  const [locationHint, setLocationHint] = useState<string>('Downtown District');
  const [recipientHint, setRecipientHint] = useState<string>('');
  const [contactHint, setContactHint] = useState<string>('');

  // AI Service State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<{
    code: string;
    message: string;
    setupInstructions?: string;
    canRetry: boolean;
  } | null>(null);
  const [serverStatus, setServerStatus] = useState<{
    configured: boolean;
    model: string;
    message: string;
  } | null>(null);

  // Extracted Result State (editable by human reviewer)
  const [aiData, setAiData] = useState<AiAnalyzedNeed | null>(null);
  const [editedTitle, setEditedTitle] = useState<string>('');
  const [editedCategory, setEditedCategory] = useState<NeedCategory>('food_nutrition');
  const [editedUrgency, setEditedUrgency] = useState<UrgencyLevel>('medium');
  const [editedQuantity, setEditedQuantity] = useState<number>(1);
  const [editedResourceName, setEditedResourceName] = useState<string>('');
  const [editedUnit, setEditedUnit] = useState<string>('units');
  const [editedLocation, setEditedLocation] = useState<string>('Downtown District');
  const [editedRecipient, setEditedRecipient] = useState<string>('');
  const [editedContact, setEditedContact] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [urgencyReviewed, setUrgencyReviewed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Check server status on mount
  useEffect(() => {
    checkGeminiServerStatus().then((status) => {
      setServerStatus(status);
    });
  }, []);

  // Quick preset triggers
  const loadPreset = (text: string, area: string, name: string, contact: string) => {
    setDescription(text);
    setLocationHint(area);
    setRecipientHint(name);
    setContactHint(contact);
    setAnalysisError(null);
  };

  const handleAnalyze = async () => {
    if (!description.trim()) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    const result = await analyzeNeedWithGeminiServer({
      description: description.trim(),
      locationAreaHint: locationHint,
      recipientNameHint: recipientHint
    });

    setIsAnalyzing(false);

    if (!result.success || !result.data) {
      setAnalysisError({
        code: result.error || 'AI_ERROR',
        message: result.message || 'Failed to analyze request with Gemini.',
        setupInstructions: result.setupInstructions,
        canRetry: result.canRetry ?? true
      });
      return;
    }

    const data = result.data;
    setAiData(data);

    // Initialize editable review state with AI values
    setEditedTitle(data.title);
    setEditedCategory(data.category);
    setEditedUrgency(data.urgency);
    setEditedQuantity(data.primaryResource.quantityNeeded);
    setEditedResourceName(data.primaryResource.resourceName);
    setEditedUnit(data.primaryResource.unit);
    setEditedLocation(data.locationAreaSuggestion || locationHint);
    setEditedRecipient(recipientHint || 'Displaced Community Members');
    setEditedContact(contactHint || 'Pending direct phone verification');
    setUrgencyReviewed(false);
  };

  const handleConfirmAndSubmit = () => {
    if (!aiData || !editedTitle.trim()) return;

    setIsSubmitting(true);

    const newReq = HumanovaStore.createRequest({
      title: editedTitle.trim(),
      description: `${description.trim()}${
        additionalNotes.trim() ? `\n\n[Human Verification Notes]: ${additionalNotes.trim()}` : ''
      }`,
      category: editedCategory,
      urgency: editedUrgency,
      locationArea: editedLocation,
      recipientName: editedRecipient.trim() || 'Community Recipient',
      recipientContact: editedContact.trim() || 'Verified via AI Intake',
      quantityNeeded: Math.max(1, editedQuantity),
      resourceName: editedResourceName.trim() || 'Prepared Nutritious Meals',
      unit: editedUnit.trim() || 'units'
    });

    setIsSubmitting(false);
    onRequestCreated(newReq);

    // Reset view
    setAiData(null);
    setDescription('');
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">Describe Your Need with AI</h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700/60 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                {aiData?.modelUsed || serverStatus?.model || 'Gemini Flash AI'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Type naturally. Gemini extracts quantities, detects missing prerequisites, and suggests a verifiable action plan for your review.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSwitchToManual}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors shrink-0 underline cursor-pointer"
        >
          Switch to Manual Intake
        </button>
      </div>

      {/* Input Phase: When no AI data is extracted yet */}
      {!aiData && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Try Benchmark Test Prompts:
            </span>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'Fifteen families in my area need food, but we only have enough supplies for ten families.',
                    'Downtown District',
                    'Oakland Neighborhood Mutual Aid',
                    '555-219-4820 (Maria)'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-700/60 transition-colors cursor-pointer font-medium"
              >
                ⭐ 15 Families Need Food (10 Available)
              </button>
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'Urgently need 12 prepared nutritious lunch meals for low-income seniors at Pineview Center today before noon.',
                    'Downtown District',
                    'Pineview Senior Hub',
                    'coordinator@pineview.org'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                12 Senior Lunches
              </button>
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'Emergency delivery needed for blood pressure medication and basic wellness check for homebound senior.',
                    'North Hills',
                    'Harold Miller (Apt 302)',
                    '555-891-2309'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Prescription & Wellness
              </button>
            </div>
          </div>

          {/* Description Textarea */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Community Need Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Fifteen families in my area need food, but we only have enough supplies for ten families. We need distribution support..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed font-sans"
            />
          </div>

          {/* Optional context hints */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Area Hint (Optional)
              </label>
              <select
                value={locationHint}
                onChange={(e) => setLocationHint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="Downtown District">Downtown District</option>
                <option value="Eastside Ward">Eastside Ward</option>
                <option value="North Hills">North Hills</option>
                <option value="West End">West End</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Recipient / Org (Optional)
              </label>
              <input
                type="text"
                value={recipientHint}
                onChange={(e) => setRecipientHint(e.target.value)}
                placeholder="e.g. Hope Haven Shelter"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Contact Phone/Email (Optional)
              </label>
              <input
                type="text"
                value={contactHint}
                onChange={(e) => setContactHint(e.target.value)}
                placeholder="e.g. 555-019-2831"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Error / Missing API Key Display */}
          {analysisError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-200 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-rose-300">
                    {analysisError.code === 'MISSING_API_KEY'
                      ? 'Gemini API Key Required'
                      : 'AI Request Analysis Error'}
                  </div>
                  <p className="text-rose-200/90 leading-relaxed">
                    {analysisError.message}
                  </p>
                </div>
              </div>

              {analysisError.setupInstructions && (
                <div className="p-3 bg-slate-950/80 border border-rose-900/60 rounded-lg text-[11px] font-mono text-slate-300 whitespace-pre-line leading-relaxed">
                  {analysisError.setupInstructions}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {analysisError.canRetry && (
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Analysis
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSwitchToManual}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs cursor-pointer"
                >
                  Use Built-in Rule Parser Instead
                </button>
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !description.trim()}
            className="w-full py-3 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-teal-200" />
                <span>Contacting Gemini AI & Extracting Structure...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analyze Need with Gemini AI</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Review Phase: Validated Structured AI Output with Human Editing & Approval */}
      {aiData && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5 animate-in fade-in">
          {/* Top Review Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/60">
                STEP 2: REVIEW & EDIT EXTRACTED INFORMATION
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-1 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                Human Review & Dependency Plan Confirmation
              </h3>
              <p className="text-xs text-slate-400">
                Gemini structured the request. Review extracted quantities, missing data, and proposed tasks before creating the verifiable plan.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60">
                Confidence: {(aiData.confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Stated Quantities vs Real Inventory Highlight */}
          {aiData.statedQuantities.length > 0 && (
            <div className="p-3.5 bg-slate-950 border border-teal-800/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-teal-400" />
                  Explicitly Stated Demand & Local Supplies (From Your Text):
                </span>
                <span className="text-[10px] font-mono text-slate-400">Strict Grounding</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {aiData.statedQuantities.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                    <div className="font-semibold text-slate-200">{item.resourceType}</div>
                    <div className="text-teal-300 font-mono text-xs">
                      Stated Need: <strong>{item.quantityNeeded} {item.unit}</strong>
                    </div>
                    {item.quantityAvailable > 0 && (
                      <div className="text-slate-400 font-mono text-[11px]">
                        Stated Available: {item.quantityAvailable} {item.unit}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 italic">"{item.context}"</div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-teal-400/90 pt-1 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>HUMANOVA Principle:</strong> The AI extracts stated figures, but warehouse shortages are calculated deterministically against real verified inventory.
                </span>
              </div>
            </div>
          )}

          {/* Form Fields: Editable by Human Reviewer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Edit3 className="w-3 h-3 text-teal-400" />
                Request Title
              </label>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Category
              </label>
              <select
                value={editedCategory}
                onChange={(e) => setEditedCategory(e.target.value as NeedCategory)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="food_nutrition">Food & Nutrition</option>
                <option value="medical_health">Medical & Health</option>
                <option value="elderly_care">Elderly Care</option>
                <option value="shelter_clothing">Shelter & Warmth</option>
                <option value="emergency_repair">Emergency Repair</option>
                <option value="transport_logistics">Transport & Logistics</option>
              </select>
            </div>

            {/* Urgency with AI Explanation and Review Checkbox */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Urgency Level
                </label>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                  Requires Human Review
                </span>
              </div>
              <select
                value={editedUrgency}
                onChange={(e) => {
                  setEditedUrgency(e.target.value as UrgencyLevel);
                  setUrgencyReviewed(true);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="low">Low (Routine / Next Week)</option>
                <option value="medium">Medium (Standard Community Aid)</option>
                <option value="high">High (Urgent / Same-Day Need)</option>
                <option value="critical">Critical (Life-Safety Emergency)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1 italic">
                AI Justification: "{aiData.urgencyExplanation}"
              </p>
            </div>

            {/* Primary Resource & Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Primary Supply Item & Unit
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={editedResourceName}
                  onChange={(e) => setEditedResourceName(e.target.value)}
                  placeholder="Resource Name"
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
                <input
                  type="text"
                  value={editedUnit}
                  onChange={(e) => setEditedUnit(e.target.value)}
                  placeholder="Unit (meals, packs)"
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Quantity Count */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Total Quantity Needed
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={editedQuantity}
                onChange={(e) => setEditedQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-mono font-bold focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Service Area */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Service Ward / Area
              </label>
              <select
                value={editedLocation}
                onChange={(e) => setEditedLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="Downtown District">Downtown District</option>
                <option value="Eastside Ward">Eastside Ward</option>
                <option value="North Hills">North Hills</option>
                <option value="West End">West End</option>
              </select>
            </div>

            {/* Recipient Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Recipient / Point of Contact Name
              </label>
              <input
                type="text"
                value={editedRecipient}
                onChange={(e) => setEditedRecipient(e.target.value)}
                placeholder="e.g. Maria Gonzalez"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Missing Information & Uncertainties Callouts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {aiData.missingInformation.length > 0 && (
              <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-1.5">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Missing Information Identified by AI:
                </div>
                <ul className="text-[11px] text-amber-200/80 space-y-1 pl-4 list-disc">
                  {aiData.missingInformation.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiData.uncertaintiesForHumanReview.length > 0 && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  Uncertainties for Human Coordinator Review:
                </div>
                <ul className="text-[11px] text-slate-400 space-y-1 pl-4 list-disc">
                  {aiData.uncertaintiesForHumanReview.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Proposed Action Steps Preview */}
          {aiData.proposedActionSteps.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Proposed Verifiable Action Steps (Decomposed by Gemini):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {aiData.proposedActionSteps.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        Step {step.stepNumber}: {step.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        ~{step.estimatedMinutes}m
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">{step.description}</p>
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {step.requiredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] font-mono text-teal-300 bg-teal-950/50 px-1.5 py-0.5 rounded border border-teal-800/40"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Coordinator / Clarification Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Add Clarifications or Notes for Assigned Volunteers (Optional):
            </label>
            <input
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g. Ring Apt 3B buzzer, dietary allergy noted: nuts."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Review Confirmation Checkbox */}
          <div className="p-3 bg-slate-950/80 border border-teal-900/40 rounded-xl flex items-center gap-3">
            <input
              type="checkbox"
              id="urgencyReviewedCheck"
              checked={urgencyReviewed}
              onChange={(e) => setUrgencyReviewed(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 bg-slate-900 border-slate-700 cursor-pointer"
            />
            <label
              htmlFor="urgencyReviewedCheck"
              className="text-xs text-slate-300 cursor-pointer select-none"
            >
              I have reviewed the AI-suggested quantities, urgency level, and task steps, and confirm this request is ready for verifiable coordination.
            </label>
          </div>

          {/* Submission and Reset Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setAiData(null)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Discard & Re-type Description
            </button>

            <button
              type="button"
              onClick={handleConfirmAndSubmit}
              disabled={isSubmitting || !editedTitle.trim()}
              className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Confirm & Generate Verifiable Dependency Plan</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
