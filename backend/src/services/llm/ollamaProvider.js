import { buildIntentPrompt } from "./prompt.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3:8b";

function extractJson(text) {
  const cleanText = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleanText);
  } catch {
    const start = cleanText.indexOf("{");
    const end = cleanText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Ollama did not return JSON.");
    }
    return JSON.parse(cleanText.slice(start, end + 1));
  }
}

export async function interpretWithOllama({ command, products }) {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 60000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: {
          temperature: 0,
          top_p: 0.2
        },
        messages: [
          {
            role: "system",
            content: "You are a strict JSON intent parser for a production workflow app."
          },
          {
            role: "user",
            content: buildIntentPrompt({
              command,
              products,
              today: new Date().toISOString().slice(0, 10)
            })
          }
        ]
      })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`Ollama request failed (${response.status}). ${message}`.trim());
    }

    const data = await response.json();
    return {
      ...extractJson(data.message?.content),
      provider: "ollama",
      model
    };
  } finally {
    clearTimeout(timeout);
  }
}
