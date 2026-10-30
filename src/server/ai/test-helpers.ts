import { vi } from "vitest";

// Shared fakes for the server AI tests. No real network calls are ever made.

export const VALID_OUTPUT = JSON.stringify({
  subtasks: [
    { title: "Outline the sections", estimateMinutes: 20, order: 1 },
    { title: "Write the first draft", estimateMinutes: 60, order: 2 },
    { title: "Proofread and publish", estimateMinutes: 25, order: 3 },
  ],
});

export function geminiSuccess(text: string): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });
}

export function geminiError(
  status: number,
  options: { retryDelay?: string; quotaId?: string; message?: string } = {},
): Response {
  const details = [
    ...(options.retryDelay
      ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: options.retryDelay }]
      : []),
    ...(options.quotaId
      ? [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [{ quotaId: options.quotaId }],
          },
        ]
      : []),
  ];
  return Response.json(
    { error: { code: status, message: options.message ?? "error", details } },
    { status },
  );
}

/** A fetch mock that answers each call with the next response (or throws an Error). */
export function fakeFetch(...responses: (Response | Error)[]) {
  return vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra fetch call");
    if (next instanceof Error) throw next;
    return next;
  });
}
