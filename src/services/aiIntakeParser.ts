import { NeedCategory, ParsedNeedIntake, UrgencyLevel } from '../types';

/**
 * Deterministic rule-based natural language parser for rapid, reliable community request intake.
 * Extracts category, urgency, item quantities, location, and flags missing information.
 */
export function parseIntakeRuleBased(
  rawText: string,
  providedLocation?: string
): ParsedNeedIntake {
  const text = rawText.toLowerCase();

  // 1. Category Detection
  let category: NeedCategory = 'food_nutrition';
  let resourceCategory: NeedCategory = 'food_nutrition';
  let resourceName = 'Prepared Nutritious Meals';
  let unit = 'meals';

  if (
    text.includes('meal') ||
    text.includes('food') ||
    text.includes('dinner') ||
    text.includes('lunch') ||
    text.includes('breakfast') ||
    text.includes('grocer') ||
    text.includes('pantry') ||
    text.includes('ration')
  ) {
    category = 'food_nutrition';
    resourceCategory = 'food_nutrition';
    resourceName = 'Prepared Nutritious Meals';
    unit = 'meals';
  } else if (
    text.includes('water') ||
    text.includes('drink') ||
    text.includes('bottle')
  ) {
    category = 'food_nutrition';
    resourceCategory = 'food_nutrition';
    resourceName = 'Clean Bottled Water Packs';
    unit = 'packs';
  } else if (
    text.includes('medic') ||
    text.includes('prescription') ||
    text.includes('pill') ||
    text.includes('pharmacy') ||
    text.includes('insulin') ||
    text.includes('hypertension') ||
    text.includes('nurse') ||
    text.includes('first aid')
  ) {
    category = 'medical_health';
    resourceCategory = 'medical_health';
    resourceName = 'Prescription Medical Kits';
    unit = 'kits';
  } else if (
    text.includes('roof') ||
    text.includes('tarp') ||
    text.includes('repair') ||
    text.includes('storm') ||
    text.includes('debris') ||
    text.includes('carpenter') ||
    text.includes('leak')
  ) {
    category = 'emergency_repair';
    resourceCategory = 'emergency_repair';
    resourceName = 'Heavy-Duty Weather Tarps';
    unit = 'units';
  } else if (
    text.includes('senior') ||
    text.includes('elderly') ||
    text.includes('wheelchair') ||
    text.includes('companion')
  ) {
    category = 'elderly_care';
    resourceCategory = 'food_nutrition';
    resourceName = 'Senior Care Support Packs';
    unit = 'kits';
  } else if (
    text.includes('shelter') ||
    text.includes('blanket') ||
    text.includes('jacket') ||
    text.includes('coat') ||
    text.includes('bed')
  ) {
    category = 'shelter_clothing';
    resourceCategory = 'shelter_clothing';
    resourceName = 'Emergency Warmth Kits';
    unit = 'kits';
  } else if (
    text.includes('ride') ||
    text.includes('drive') ||
    text.includes('transport') ||
    text.includes('transit')
  ) {
    category = 'transport_logistics';
    resourceCategory = 'transport_logistics';
    resourceName = 'Transport Fuel Voucher';
    unit = 'trips';
  }

  // 2. Quantity Extraction
  // Look for patterns like "12 meals", "8 people", "need 20", "for 5 families"
  let quantityNeeded = 1;
  const quantityMatch = text.match(/(\d+)\s*(meals?|portions?|people|family|families|packs?|kits?|boxes|units?|bottles?)?/i);
  if (quantityMatch && parseInt(quantityMatch[1], 10) > 0) {
    quantityNeeded = Math.min(200, parseInt(quantityMatch[1], 10));
  } else {
    // Check words
    if (text.includes('twenty')) quantityNeeded = 20;
    else if (text.includes('twelve')) quantityNeeded = 12;
    else if (text.includes('ten')) quantityNeeded = 10;
    else if (text.includes('eight')) quantityNeeded = 8;
    else if (text.includes('five')) quantityNeeded = 5;
    else if (text.includes('two')) quantityNeeded = 2;
  }

  // 3. Urgency Detection
  let urgency: UrgencyLevel = 'medium';
  if (
    text.includes('life threatening') ||
    text.includes('emergency') ||
    text.includes('critical') ||
    text.includes('immediately') ||
    text.includes('asap') ||
    text.includes('without medicine')
  ) {
    urgency = 'critical';
  } else if (
    text.includes('today') ||
    text.includes('urgent') ||
    text.includes('tonight') ||
    text.includes('before evening') ||
    text.includes('running out')
  ) {
    urgency = 'high';
  } else if (
    text.includes('routine') ||
    text.includes('next week') ||
    text.includes('low priority')
  ) {
    urgency = 'low';
  }

  // 4. Location Area Extraction
  let locationArea = providedLocation || 'Downtown District';
  if (text.includes('eastside') || text.includes('east side') || text.includes('haven')) {
    locationArea = 'Eastside Ward';
  } else if (text.includes('north hills') || text.includes('north end') || text.includes('uptown')) {
    locationArea = 'North Hills';
  } else if (text.includes('west end') || text.includes('westside')) {
    locationArea = 'West End';
  } else if (text.includes('downtown') || text.includes('pineview') || text.includes('central')) {
    locationArea = 'Downtown District';
  }

  // 5. Identified Skills
  const identifiedSkills: string[] = [];
  if (category === 'food_nutrition') {
    identifiedSkills.push('Food Handling', 'Vehicle Delivery');
  } else if (category === 'medical_health') {
    identifiedSkills.push('First Aid & Medical', 'Prescription Handling');
  } else if (category === 'emergency_repair') {
    identifiedSkills.push('Emergency Repair', 'Carpentry & Tools', 'Heavy Lifting');
  } else if (category === 'elderly_care') {
    identifiedSkills.push('Elderly Care', 'Social Work');
  } else {
    identifiedSkills.push('Vehicle Delivery');
  }

  // 6. Missing Information Check
  const missingInformation: string[] = [];
  if (!rawText.match(/\d+/)) {
    missingInformation.push('Exact quantity count not specified (defaulted to 1).');
  }
  if (!rawText.includes('@') && !rawText.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)) {
    missingInformation.push('Direct callback phone or email is recommended for delivery handoff.');
  }
  if (rawText.length < 30) {
    missingInformation.push('Brief description lacks access/drop-off instructions.');
  }

  // Generate Title
  const cleanSummary = rawText.split('\n')[0].substring(0, 65).trim();
  const title =
    cleanSummary.length > 10
      ? cleanSummary.charAt(0).toUpperCase() + cleanSummary.slice(1)
      : `${urgency.toUpperCase()} Need: ${quantityNeeded} ${resourceName}`;

  return {
    title,
    category,
    urgency,
    quantityNeeded,
    resourceName,
    resourceCategory,
    unit,
    locationArea,
    identifiedSkills,
    missingInformation,
    confidence: 0.92
  };
}

/**
 * Checks server-side Gemini availability and configuration status.
 */
export async function checkGeminiServerStatus(): Promise<{
  configured: boolean;
  model: string;
  status: 'ready' | 'unconfigured';
  message: string;
}> {
  try {
    const res = await fetch('/api/gemini/status', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return {
      configured: false,
      model: 'gemini-3.8-flash',
      status: 'unconfigured',
      message: err instanceof Error ? err.message : 'Unable to connect to AI server route.',
    };
  }
}

export interface AnalyzeNeedParams {
  description: string;
  locationAreaHint?: string;
  recipientNameHint?: string;
}

export interface AnalyzeNeedResult {
  success: boolean;
  data?: import('../types').AiAnalyzedNeed;
  error?: string;
  message?: string;
  setupInstructions?: string;
  canRetry?: boolean;
}

/**
 * Calls server-side Gemini 3.8 Flash endpoint to analyze natural-language requests.
 * Securely communicates with the backend without exposing keys.
 */
export async function analyzeNeedWithGeminiServer(
  params: AnalyzeNeedParams
): Promise<AnalyzeNeedResult> {
  try {
    const res = await fetch('/api/gemini/analyze-need', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      return {
        success: false,
        error: json.error || 'SERVER_ERROR',
        message: json.message || `Server returned error (${res.status})`,
        setupInstructions: json.setupInstructions,
        canRetry: json.canRetry ?? true,
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error communicating with AI server.';
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: `Failed to reach server: ${message}`,
      canRetry: true,
    };
  }
}

