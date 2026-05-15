const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function buildResponsePrompt({ command, intent, result, language }) {
  const lang = language === "en" ? "English" : "Slovenian";
  const resultJson = JSON.stringify(result, null, 2).slice(0, 2000);

  return `You are an assistant for a production workflow system. The user sent a command and the system executed it. Write a short, natural ${lang} response summarizing what happened.

User command: "${command}"
Action executed: ${intent}
Result:
${resultJson}

Rules:
- Be concise (1-3 sentences)
- Mention key facts from the result (counts, names, codes, status)
- If it was a list, mention how many items and name a few
- If it was a create/update/delete, confirm what was done
- Do not mention JSON, technical fields, or internal codes
- Write in ${lang}
- Do not repeat the user's command verbatim

Response:`;
}

async function formatWithOllama({ prompt }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.3 },
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    return data.message?.content?.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() || null;
  } finally {
    clearTimeout(timeout);
  }
}

async function formatWithOpenAI({ prompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are a concise production workflow assistant." },
          { role: "user", content: prompt }
        ]
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function formatMcpResponse({ command, intent, result, provider, language = "sl" }) {
  const prompt = buildResponsePrompt({ command, intent, result, language });
  try {
    if (provider === "openai") return await formatWithOpenAI({ prompt });
    return await formatWithOllama({ prompt });
  } catch {
    return null;
  }
}
