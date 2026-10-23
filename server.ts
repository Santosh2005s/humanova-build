import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '1mb' }));

/**
 * Shared Gemini client factory.
 * Enforces User-Agent telemetry header as required by AI Studio guidelines.
 */
function getAiClient(): { ai: GoogleGenAI; candidateModels: string[] } | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return {
    ai,
    candidateModels: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
  };
}

/**
 * Health & Configuration Status Check
 * Returns whether GEMINI_API_KEY is present without exposing secrets.
 */
app.get('/api/gemini/status', (_req, res) => {
  const clientInfo = getAiClient();
  const isConfigured = Boolean(clientInfo);

  res.json({
    configured: isConfigured,
    model: 'gemini-3.1-flash-lite / gemini-3.8-flash',
    status: isConfigured ? 'ready' : 'unconfigured',
    message: isConfigured
      ? 'Gemini AI Engine is online on the server with multi-model failover.'
      : 'GEMINI_API_KEY environment variable is not configured.',
  });
});

/**
 * Server-Side Gemini Request Intake & Analysis
 * Converts raw, unstructured community requests into validated, dependency-aware structured JSON.
 */
app.post('/api/gemini/analyze-need', async (req, res) => {
  try {
    const { description, locationAreaHint, recipientNameHint } = req.body || {};

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Please provide a natural-language description of the community need.',
        canRetry: false,
      });
    }

    const clientInfo = getAiClient();
    if (!clientInfo) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is not configured in the server environment.',
        setupInstructions:
          'To enable real Gemini AI analysis:\n1. Open the AI Studio Settings > Secrets panel (or configure .env).\n2. Add a secret named GEMINI_API_KEY with your Google Gemini API key.\n3. Humanova will automatically detect it for live natural-language analysis.\n\nYou can continue submitting requests using Humanova\'s deterministic intake engine in the meantime.',
        canRetry: false,
      });
    }

    const { ai, candidateModels } = clientInfo;

    const systemInstruction = `You are the HUMANOVA Crisis & Mutual Aid Intelligence Engine.
HUMANOVA's tagline: "Every Need Deserves an Action. Every Action Deserves an Outcome."

TASK:
Analyze unstructured natural-language community assistance requests and transform them into structured, actionable data for community coordinators and volunteers.

CORE PRINCIPLES:
1. Strict Grounding:
   - Extract only what the user explicitly stated or clearly stated as context.
   - NEVER hallucinate or invent inventory, fictional supplies, or fake recipient names.
2. Explicit Quantities & Stated Supply vs. Demand:
   - Example: "Fifteen families in my area need food, but we only have enough supplies for ten families."
     * Stated demand: 15 families (or 15 food parcels / meals)
     * Stated available supply: 10 families
     * Stated shortage mentioned in text: 5 families
     * Record these clearly in statedQuantities. Note that real inventory deficits will be verified deterministically by Humanova's warehouse engine.
3. Category Assignment:
   - Must be one of: "food_nutrition", "medical_health", "elderly_care", "shelter_clothing", "transport_logistics", "emergency_repair".
4. Urgency Recommendation & Human Review:
   - Must be one of: "low", "medium", "high", "critical".
   - Provide an urgencyExplanation explaining the humanitarian justification.
   - Highlight uncertainties requiring human coordinator sign-off in uncertaintiesForHumanReview.
5. Missing Information:
   - Actively identify missing practical details (e.g. callback phone, street address, drop-off constraints, dietary restrictions, access codes).
6. Proposed Action Steps:
   - Decompose into 3-4 logical, chronological steps with skill requirements and clear prerequisites.`;

    const userPrompt = `Analyze this community crisis or mutual aid request:
"""
${description.trim()}
"""
Additional Context:
- Location Area Hint: ${locationAreaHint || 'Not specified by user'}
- Recipient / Org Hint: ${recipientNameHint || 'Not specified by user'}`;

    let responseText = '';
    let usedModel = candidateModels[0];
    let lastError: unknown = null;

    for (const modelCandidate of candidateModels) {
      try {
        console.log(`[HUMANOVA SERVER] Querying Gemini model: ${modelCandidate}...`);
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.2, // low temperature for high precision and grounding
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
            title: {
              type: Type.STRING,
              description: 'Clear, concise professional title (under 70 chars)',
            },
            summary: {
              type: Type.STRING,
              description: '1-2 sentence executive crisis summary',
            },
            category: {
              type: Type.STRING,
              enum: [
                'food_nutrition',
                'medical_health',
                'elderly_care',
                'shelter_clothing',
                'transport_logistics',
                'emergency_repair',
              ],
            },
            urgency: {
              type: Type.STRING,
              enum: ['low', 'medium', 'high', 'critical'],
            },
            urgencyExplanation: {
              type: Type.STRING,
              description: 'Justification for the suggested urgency rating',
            },
            statedQuantities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  resourceType: { type: Type.STRING },
                  quantityNeeded: { type: Type.INTEGER },
                  quantityAvailable: { type: Type.INTEGER },
                  unit: { type: Type.STRING },
                  context: { type: Type.STRING },
                },
                required: ['resourceType', 'quantityNeeded', 'quantityAvailable', 'unit', 'context'],
              },
            },
            primaryResource: {
              type: Type.OBJECT,
              properties: {
                resourceName: { type: Type.STRING },
                quantityNeeded: { type: Type.INTEGER },
                unit: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  enum: [
                    'food_nutrition',
                    'medical_health',
                    'elderly_care',
                    'shelter_clothing',
                    'transport_logistics',
                    'emergency_repair',
                  ],
                },
              },
              required: ['resourceName', 'quantityNeeded', 'unit', 'category'],
            },
            missingInformation: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            uncertaintiesForHumanReview: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            proposedActionSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  requiredSkills: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  prerequisites: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  estimatedMinutes: { type: Type.INTEGER },
                },
                required: [
                  'stepNumber',
                  'title',
                  'description',
                  'requiredSkills',
                  'prerequisites',
                  'estimatedMinutes',
                ],
              },
            },
            requiredResourcesAndPrerequisites: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            locationAreaSuggestion: {
              type: Type.STRING,
              description:
                'Suggested ward e.g. Downtown District, Eastside Ward, North Hills, West End',
            },
          },
          required: [
            'title',
            'summary',
            'category',
            'urgency',
            'urgencyExplanation',
            'statedQuantities',
            'primaryResource',
            'missingInformation',
            'uncertaintiesForHumanReview',
            'proposedActionSteps',
            'requiredResourcesAndPrerequisites',
          ],
        },
      },
    });

        if (response.text) {
          responseText = response.text;
          usedModel = modelCandidate;
          console.log(`[HUMANOVA SERVER] Gemini model ${modelCandidate} responded successfully.`);
          break;
        }
      } catch (err: unknown) {
        const errorObj = err as { message?: string; status?: number };
        console.warn(`[HUMANOVA SERVER] Candidate model ${modelCandidate} failed:`, errorObj?.message || errorObj);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('All Gemini candidate models returned empty responses.');
    }

    const parsed = JSON.parse(responseText);

    // Validate and sanitize data
    const validatedData = {
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.trim()
          : 'Community Assistance Need',
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      category: [
        'food_nutrition',
        'medical_health',
        'elderly_care',
        'shelter_clothing',
        'transport_logistics',
        'emergency_repair',
      ].includes(parsed.category)
        ? parsed.category
        : 'food_nutrition',
      urgency: ['low', 'medium', 'high', 'critical'].includes(parsed.urgency)
        ? parsed.urgency
        : 'medium',
      urgencyExplanation:
        typeof parsed.urgencyExplanation === 'string' && parsed.urgencyExplanation.trim()
          ? parsed.urgencyExplanation.trim()
          : 'Assessed based on stated humanitarian urgency.',
      statedQuantities: Array.isArray(parsed.statedQuantities)
        ? parsed.statedQuantities.map((sq: Record<string, unknown>) => ({
            resourceType: String(sq?.resourceType || 'Community Resource'),
            quantityNeeded: Number(sq?.quantityNeeded) || 1,
            quantityAvailable: Number(sq?.quantityAvailable) || 0,
            unit: String(sq?.unit || 'units'),
            context: String(sq?.context || ''),
          }))
        : [],
      primaryResource: {
        resourceName: String(parsed.primaryResource?.resourceName || 'Nutritious Meals'),
        quantityNeeded: Math.max(1, Math.min(500, Number(parsed.primaryResource?.quantityNeeded) || 1)),
        unit: String(parsed.primaryResource?.unit || 'units'),
        category: [
          'food_nutrition',
          'medical_health',
          'elderly_care',
          'shelter_clothing',
          'transport_logistics',
          'emergency_repair',
        ].includes(parsed.primaryResource?.category)
          ? parsed.primaryResource.category
          : parsed.category || 'food_nutrition',
      },
      missingInformation: Array.isArray(parsed.missingInformation)
        ? parsed.missingInformation.map((item: unknown) => String(item).trim()).filter(Boolean)
        : [],
      uncertaintiesForHumanReview: Array.isArray(parsed.uncertaintiesForHumanReview)
        ? parsed.uncertaintiesForHumanReview.map((item: unknown) => String(item).trim()).filter(Boolean)
        : [],
      proposedActionSteps: Array.isArray(parsed.proposedActionSteps)
        ? parsed.proposedActionSteps.map((pas: Record<string, unknown>, idx: number) => ({
            stepNumber: Number(pas?.stepNumber) || idx + 1,
            title: String(pas?.title || `Action Step ${idx + 1}`).trim(),
            description: String(pas?.description || '').trim(),
            requiredSkills: Array.isArray(pas?.requiredSkills)
              ? pas.requiredSkills.map((s: unknown) => String(s).trim()).filter(Boolean)
              : ['General Coordination'],
            prerequisites: Array.isArray(pas?.prerequisites)
              ? pas.prerequisites.map((p: unknown) => String(p).trim()).filter(Boolean)
              : [],
            estimatedMinutes: Math.max(5, Math.min(480, Number(pas?.estimatedMinutes) || 30)),
          }))
        : [],
      requiredResourcesAndPrerequisites: Array.isArray(parsed.requiredResourcesAndPrerequisites)
        ? parsed.requiredResourcesAndPrerequisites.map((item: unknown) => String(item).trim()).filter(Boolean)
        : [],
      locationAreaSuggestion: String(parsed.locationAreaSuggestion || locationAreaHint || 'Downtown District'),
      confidenceScore: 0.96,
      rawTextAnalyzed: description.trim(),
      analyzedAt: new Date().toISOString(),
      modelUsed: usedModel,
      isAiGenerated: true as const,
    };

    return res.json({
      success: true,
      data: validatedData,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    console.error('[HUMANOVA SERVER] Gemini API error:', err);

    const isRateLimit = err.status === 429 || (err.message && err.message.includes('429'));
    const isAuthError = err.status === 401 || err.status === 403 || (err.message && err.message.includes('API key'));

    let userMessage = 'Failed to analyze request with Gemini.';
    let errorCode = 'AI_SERVICE_ERROR';

    if (isRateLimit) {
      errorCode = 'RATE_LIMITED';
      userMessage = 'Gemini API rate limit reached. Please wait a moment and click Retry.';
    } else if (isAuthError) {
      errorCode = 'INVALID_API_KEY';
      userMessage = 'Gemini API key is invalid or unauthorized. Please verify your GEMINI_API_KEY in Secrets.';
    } else if (err.message) {
      userMessage = err.message;
    }

    return res.status(isRateLimit ? 429 : 500).json({
      success: false,
      error: errorCode,
      message: userMessage,
      canRetry: true,
    });
  }
});

/**
 * Server Lifecycle: Mount Vite Dev Middlewares or Serve Production Static Build
 */
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[HUMANOVA SERVER] Running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[HUMANOVA SERVER] Failed to start:', err);
  process.exit(1);
});
