export class OpenAIError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "OpenAIError";
  }
}

export function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local to enable AI features."
    );
  }
  return apiKey;
}

export async function callOpenAI(input: {
  system: string;
  user: string;
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = getOpenAIKey();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: input.temperature ?? 0.3,
      max_tokens: input.maxTokens ?? 1200,
      ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new OpenAIError(
      `OpenAI API error: ${response.status} — ${err.slice(0, 300)}`,
      response.status
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content as string | undefined;
  if (!content?.trim()) throw new Error("Empty response from AI");
  return content;
}