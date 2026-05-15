import { buildIntentPrompt } from "./prompt.js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

function extractJson(text) {
  const cleanText = String(text || "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleanText);
  } catch {
    const start = cleanText.indexOf("{");
    const end = cleanText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("OpenAI did not return valid JSON.");
    }
    return JSON.parse(cleanText.slice(start, end + 1));
  }
}

export async function interpretWithOpenAI({ command, products, language = "sl" }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 30000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a strict JSON intent parser for a production workflow app. Return only valid JSON."
          },
          {
            role: "user",
            content: buildIntentPrompt({
              command,
              products,
              language,
              today: new Date().toISOString().slice(0, 10)
            })
          }
        ]
      })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`OpenAI request failed (${response.status}). ${message}`.trim());
    }

    const data = await response.json();
    return {
      ...extractJson(data.choices?.[0]?.message?.content),
      provider: "openai",
      model
    };
  } finally {
    clearTimeout(timeout);
  }
}
