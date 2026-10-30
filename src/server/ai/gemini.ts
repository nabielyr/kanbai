import "server-only";
import { MAX_SUBTASKS, MIN_SUBTASKS } from "@/lib/ai/schemas";
import {
  failureFromStatus,
  failureFromThrown,
  parseRetryAfter,
  ProviderError,
  type LlmProvider,
} from "./provider";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini's native structured output: the model must return JSON in this shape. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    subtasks: {
      type: "ARRAY",
      minItems: MIN_SUBTASKS,
      maxItems: MAX_SUBTASKS,
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          estimateMinutes: { type: "INTEGER" },
          order: { type: "INTEGER" },
        },
        required: ["title", "estimateMinutes", "order"],
        propertyOrdering: ["title", "estimateMinutes", "order"],
      },
    },
  },
  required: ["subtasks"],
} as const;

interface GeminiErrorBody {
  error?: {
    message?: string;
    status?: string;
    details?: { "@type"?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[];
  };
}

interface GeminiResponseBody {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function createGeminiProvider(options: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): LlmProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  // Flash 2.5 models "think" by default, which adds seconds; subtasks don't need it.
  const thinkingConfig = /gemini-2\.5-flash/i.test(options.model)
    ? { thinkingConfig: { thinkingBudget: 0 } }
    : {};

  return {
    name: "gemini",
    async generate(prompt, signal) {
      let response: Response;
      try {
        response = await fetchImpl(
          `${API_BASE}/${encodeURIComponent(options.model)}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: prompt.system }] },
              contents: [{ role: "user", parts: [{ text: prompt.user }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: GEMINI_RESPONSE_SCHEMA,
                temperature: 0.4,
                maxOutputTokens: 2048,
                ...thinkingConfig,
              },
            }),
            signal,
          },
        );
      } catch (error) {
        failureFromThrown("gemini", error, signal);
      }

      if (!response.ok) {
        const body = await readJson<GeminiErrorBody>(response);
        const details = body?.error?.details ?? [];
        throw failureFromStatus("gemini", response.status, {
          message: body?.error?.message ?? response.statusText,
          retryAfterSec:
            parseRetryAfter(details.find((d) => d.retryDelay)?.retryDelay) ??
            parseRetryAfter(response.headers.get("retry-after")),
          // Per-minute and per-day limits both answer 429; the quota id tells them apart.
          dailyQuota: details.some((d) =>
            d.violations?.some((v) => /PerDay/i.test(v.quotaId ?? "")),
          ),
        });
      }

      const body = await readJson<GeminiResponseBody>(response);
      if (body?.promptFeedback?.blockReason) {
        throw new ProviderError(
          "gemini",
          "rejected",
          `blocked: ${body.promptFeedback.blockReason}`,
        );
      }
      return (body?.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
    },
  };
}
