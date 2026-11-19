import { GoogleGenAI, Type } from '@google/genai';

export type GradingProviderId = 'deepseek' | 'openai-compatible' | 'gemini';

export interface GradingProviderInfo {
  id: GradingProviderId;
  label: string;
  model: string;
  configured: boolean;
  supportsVision: boolean;
}

export interface GradeStructuredInput {
  promptEn: string;
  markSchemePoints: string[];
  modelAnswer?: string;
  explanationEn?: string;
  maxMarks: number;
  studentAnswer: string;
  studentImageBase64?: string; // Raw base64 (without data:... prefix) or full data URL
  studentImageMimeType?: string;
  preferredProvider?: GradingProviderId | 'auto';
}

export interface GradeStructuredOutput {
  awardedMarks: number;
  feedbackZh: string;
  matchedPoints: string[];
  missedPoints: string[];
  providerId: string;
  providerLabel: string;
  model: string;
}

function isRealSecret(val: string | undefined): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return !/^(MY_|CHANGE_ME|YOUR_|PLACEHOLDER)/i.test(trimmed);
}

function getDeepSeekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!isRealSecret(apiKey)) return null;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').trim();
  const model = (process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim();
  return { apiKey: apiKey.trim(), baseUrl, model };
}

function getOpenAiCompatibleConfig() {
  const apiKey = process.env.GRADING_AI_API_KEY;
  if (!isRealSecret(apiKey)) return null;
  const baseUrl = (
    process.env.GRADING_AI_BASE_URL || 'https://api.deepseek.com/v1'
  ).trim();
  const model = (process.env.GRADING_AI_MODEL || 'deepseek-chat').trim();
  const label = (process.env.GRADING_AI_LABEL || '外部 OpenAI 兼容 AI').trim();
  return { apiKey: apiKey.trim(), baseUrl, model, label };
}

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isRealSecret(apiKey)) return null;
  return { apiKey: apiKey.trim(), model: 'gemini-4-hydrogen' };
}

export function getGradingProvidersStatus(): {
  defaultProvider: GradingProviderId | null;
  providers: GradingProviderInfo[];
} {
  const custom = getOpenAiCompatibleConfig();
  const deepseek = getDeepSeekConfig();
  const gemini = getGeminiConfig();

  const customSupportsVision = Boolean(
    custom && /(gpt-4|gpt-5|vl|vision|omni|gemini|claude|qwen2\.5-vl|qwen-vl)/i.test(custom.model)
  );

  const providers: GradingProviderInfo[] = [
    {
      id: 'openai-compatible',
      label: custom?.label ?? '自定义 AI 接口 (OpenAI 兼容)',
      model: custom?.model ?? (process.env.GRADING_AI_MODEL || 'custom-model'),
      configured: Boolean(custom),
      supportsVision: customSupportsVision,
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      model: deepseek?.model ?? (process.env.DEEPSEEK_MODEL || 'deepseek-chat'),
      configured: Boolean(deepseek),
      supportsVision: false,
    },
    {
      id: 'gemini',
      label: 'Gemini',
      model: gemini?.model ?? 'gemini-4-hydrogen',
      configured: Boolean(gemini),
      supportsVision: Boolean(gemini),
    },
  ];

  const envPreferred = (process.env.GRADING_AI_PROVIDER || 'auto').trim().toLowerCase();
  let defaultProvider: GradingProviderId | null = null;

  if (
    (envPreferred === 'openai-compatible' && custom) ||
    (envPreferred === 'deepseek' && deepseek) ||
    (envPreferred === 'gemini' && gemini)
  ) {
    defaultProvider = envPreferred;
  } else if (custom) {
    defaultProvider = 'openai-compatible';
  } else if (deepseek) {
    defaultProvider = 'deepseek';
  } else if (gemini) {
    defaultProvider = 'gemini';
  }

  return { defaultProvider, providers };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : withoutThink).trim();

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildGradingPromptText(input: GradeStructuredInput): string {
  const msLines = (input.markSchemePoints ?? []).filter((s) => s.trim().length > 0);
  return [
    `You are a strict CAIE A-Level Chemistry (9701) examiner grading a student's structured response.`,
    `Question:\n${input.promptEn}`,
    `Maximum Marks: ${input.maxMarks}`,
    msLines.length > 0
      ? `Official Mark Scheme Points:\n${msLines.join('\n')}`
      : 'Official Mark Scheme Points: (Not provided as text; grade using accurate CAIE 9701 chemistry criteria)',
    input.modelAnswer ? `Model Answer:\n${input.modelAnswer}` : '',
    input.explanationEn ? `Examiner Note:\n${input.explanationEn}` : '',
    input.studentAnswer?.trim()
      ? `Student Typed Answer:\n${input.studentAnswer.trim()}`
      : 'Student Typed Answer: (None — see attached handwritten answer photo)',
    input.studentImageBase64
      ? 'An image of the student’s handwritten working / organic structural formula / mechanism curly arrows is attached. Carefully inspect all chemical equations, arrows, charges, lone pairs, dipoles, and calculation steps in the image.'
      : '',
    `Task:`,
    `1. Award integer marks strictly from 0 to ${input.maxMarks} based on the official mark scheme points.`,
    `2. List which mark scheme points were matched ("matchedPoints") and which were missed ("missedPoints").`,
    `3. Write concise, helpful Chinese examiner feedback ("feedbackZh") explaining what earned marks and what keywords, state symbols, stoichiometry, curly arrows, or reasoning were missing.`,
    `4. Return ONLY valid JSON with exact keys: {"awardedMarks": number, "feedbackZh": string, "matchedPoints": string[], "missedPoints": string[]}.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parseImagePayload(
  raw?: string,
  mimeHint?: string
): { mimeType: string; base64Data: string; dataUrl: string } | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64Data: match[2], dataUrl: trimmed };
  }
  const mimeType = mimeHint && mimeHint.startsWith('image/') ? mimeHint : 'image/jpeg';
  return {
    mimeType,
    base64Data: trimmed,
    dataUrl: `data:${mimeType};base64,${trimmed}`,
  };
}

function normalizeOutput(
  parsed: Record<string, unknown> | null,
  input: GradeStructuredInput,
  meta: { providerId: string; providerLabel: string; model: string }
): GradeStructuredOutput {
  if (!parsed) {
    return {
      awardedMarks: 0,
      feedbackZh: 'AI 返回格式解析异常，请对照下方官方 Mark Scheme 自评得分。',
      matchedPoints: [],
      missedPoints: input.markSchemePoints ?? [],
      ...meta,
    };
  }
  const rawMarks = Number(parsed.awardedMarks);
  const awardedMarks = Number.isFinite(rawMarks)
    ? Math.max(0, Math.min(input.maxMarks, Math.round(rawMarks)))
    : 0;
  const matchedPoints = Array.isArray(parsed.matchedPoints)
    ? parsed.matchedPoints.map(String)
    : [];
  const missedPoints = Array.isArray(parsed.missedPoints)
    ? parsed.missedPoints.map(String)
    : [];
  const feedbackZh =
    typeof parsed.feedbackZh === 'string' && parsed.feedbackZh.trim()
      ? parsed.feedbackZh.trim()
      : '已完成对比批改，请结合下方 Mark Scheme 复核得分。';

  return {
    awardedMarks,
    feedbackZh,
    matchedPoints,
    missedPoints,
    ...meta,
  };
}

async function callOpenAiCompatibleGrader(
  cfg: { apiKey: string; baseUrl: string; model: string; label: string; providerId: GradingProviderId },
  input: GradeStructuredInput
): Promise<GradeStructuredOutput> {
  const cleanBase = cfg.baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const promptText = buildGradingPromptText(input);
  const isReasoner = cfg.model.toLowerCase().includes('reasoner');
  const parsedImg = parseImagePayload(input.studentImageBase64, input.studentImageMimeType);

  async function sendRequest(useJsonFormat: boolean) {
    const userContent: unknown = parsedImg
      ? [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: parsedImg.dataUrl } },
        ]
      : promptText;

    const payload: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a strict Cambridge International AS & A Level Chemistry (9701) examiner. Always respond with valid JSON only.',
        },
        { role: 'user', content: userContent },
      ],
      ...(isReasoner ? {} : { temperature: 0.1 }),
      ...(useJsonFormat ? { response_format: { type: 'json_object' } } : {}),
    };

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000),
    });
  }

  let resp = await sendRequest(!isReasoner);
  if (resp.status === 400 && !isReasoner) {
    // Some OpenAI-compatible endpoints don't support response_format: json_object
    resp = await sendRequest(false);
  }

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`${cfg.label} API 返回 HTTP ${resp.status}${errBody ? `: ${errBody.slice(0, 180)}` : ''}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  const parsed = extractJsonObject(content);

  return normalizeOutput(parsed, input, {
    providerId: cfg.providerId,
    providerLabel: cfg.label,
    model: cfg.model,
  });
}

async function callGeminiGrader(
  apiKey: string,
  model: string,
  input: GradeStructuredInput
): Promise<GradeStructuredOutput> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const promptText = buildGradingPromptText(input);
  const parsedImg = parseImagePayload(input.studentImageBase64, input.studentImageMimeType);
  const contents = parsedImg
    ? {
        parts: [
          {
            inlineData: {
              mimeType: parsedImg.mimeType,
              data: parsedImg.base64Data,
            },
          },
          { text: promptText },
        ],
      }
    : promptText;

  const resp = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          awardedMarks: { type: Type.INTEGER },
          feedbackZh: { type: Type.STRING },
          matchedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          missedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['awardedMarks', 'feedbackZh', 'matchedPoints', 'missedPoints'],
      },
    },
  });

  const parsed = extractJsonObject(resp.text ?? '');
  return normalizeOutput(parsed, input, {
    providerId: 'gemini',
    providerLabel: 'Gemini',
    model,
  });
}

export async function gradeStructuredWithAi(
  input: GradeStructuredInput
): Promise<GradeStructuredOutput> {
  const { defaultProvider } = getGradingProvidersStatus();
  const requested =
    input.preferredProvider && input.preferredProvider !== 'auto'
      ? input.preferredProvider
      : defaultProvider;

  const custom = getOpenAiCompatibleConfig();
  const deepseek = getDeepSeekConfig();
  const gemini = getGeminiConfig();

  const hasImage = Boolean(input.studentImageBase64?.trim());
  const customSupportsVision = Boolean(
    custom && /(gpt-4|gpt-5|vl|vision|omni|gemini|claude|qwen2\.5-vl|qwen-vl)/i.test(custom.model)
  );

  let chosen: GradingProviderId | null =
    (requested === 'openai-compatible' && custom) ||
    (requested === 'deepseek' && deepseek) ||
    (requested === 'gemini' && gemini)
      ? requested
      : defaultProvider;

  // If the student uploaded a handwritten photo, prefer a vision-capable provider automatically
  if (hasImage) {
    const chosenSupportsVision =
      (chosen === 'gemini' && Boolean(gemini)) ||
      (chosen === 'openai-compatible' && customSupportsVision);
    if (!chosenSupportsVision) {
      if (gemini) {
        chosen = 'gemini';
      } else if (custom && customSupportsVision) {
        chosen = 'openai-compatible';
      } else if (!input.studentAnswer?.trim()) {
        return {
          awardedMarks: 0,
          feedbackZh:
            '当前配置的模型暂不支持识图批改手写照片。你可以直接对照下方官方 Mark Scheme 自评得分，或在环境变量接入支持视觉的模型（如 Gemini / Qwen-VL / GPT-4o）。',
          matchedPoints: [],
          missedPoints: input.markSchemePoints ?? [],
          providerId: chosen ?? 'unconfigured',
          providerLabel: '当前模型仅支持纯文本',
          model: 'text-only',
        };
      }
    }
  }

  if (!chosen) {
    return {
      awardedMarks: 0,
      feedbackZh:
        '服务端尚未配置阅卷 AI Key（可在环境变量设置 DEEPSEEK_API_KEY 或 GRADING_AI_API_KEY + GRADING_AI_BASE_URL）。当前请直接对照下方官方 Mark Scheme 自评得分。',
      matchedPoints: [],
      missedPoints: input.markSchemePoints ?? [],
      providerId: 'unconfigured',
      providerLabel: '未配置阅卷 AI',
      model: 'none',
    };
  }

  if (chosen === 'openai-compatible' && custom) {
    return callOpenAiCompatibleGrader(
      {
        providerId: 'openai-compatible',
        label: custom.label,
        apiKey: custom.apiKey,
        baseUrl: custom.baseUrl,
        model: custom.model,
      },
      input
    );
  }

  if (chosen === 'deepseek' && deepseek) {
    return callOpenAiCompatibleGrader(
      {
        providerId: 'deepseek',
        label: 'DeepSeek',
        apiKey: deepseek.apiKey,
        baseUrl: deepseek.baseUrl,
        model: deepseek.model,
      },
      input
    );
  }

  if (chosen === 'gemini' && gemini) {
    return callGeminiGrader(gemini.apiKey, gemini.model, input);
  }

  return {
    awardedMarks: 0,
    feedbackZh: '未找到可用的 AI 阅卷配置，请对照下方 Mark Scheme 自评。',
    matchedPoints: [],
    missedPoints: input.markSchemePoints ?? [],
    providerId: 'unconfigured',
    providerLabel: '未配置阅卷 AI',
    model: 'none',
  };
}
