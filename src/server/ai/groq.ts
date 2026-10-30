import "server-only";
import {
  failureFromStatus,
  failureFromThrown,
  parseRetryAfter,
  ProviderError,
  readJson,
  type LlmProvider,
} from "./provider";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

interface GroqErrorBody {
  error?: { message?: string; code?: string };
}

interface GroqResponseBody {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
}

/**
 * Groq's OpenAI-compatible API. Its JSON mode guarantees valid JSON but not our schema,
 * so the Zod validation in normalize.ts does the real checking.
 */
export function createGroqProvider(options: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): LlmProvider {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: "groq",
    async generate(prompt, signal) {
      let response: Response;
      try {
        response = await fetchImpl(API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify({
            model: options.model,
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
            response_format: { type: "json_object" },
            temperature: 0.4,
            max_tokens: 1024,
          }),
          signal,
        });
      } catch (error) {
        failureFromThrown("groq", error, signal);
      }

      if (!response.ok) {
        const message =
          (await readJson<GroqErrorBody>(response))?.error?.message ?? response.statusText;
        // 498: Groq's "capacity exceeded" — temporary, like a 503.
        if (response.status === 498) throw new ProviderError("groq", "unavailable", message);
        throw failureFromStatus("groq", response.status, {
          message,
          retryAfterSec: parseRetryAfter(response.headers.get("retry-after")),
          // Groq names the exhausted limit in the message, e.g. "tokens per day (TPD)".
          dailyQuota: /per day|\((?:RPD|TPD)\)/i.test(message),
        });
      }

      const body = await readJson<GroqResponseBody>(response);
      return body?.choices?.[0]?.message?.content ?? "";
    },
  };
}
