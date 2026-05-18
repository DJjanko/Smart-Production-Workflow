const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const QUALITY_RUBRIC = `
Quality measures how useful, complete, and appropriate the answer is (1–5):
1 - Very poor. Incorrect, irrelevant, or unusable.
2 - Weak. Only partly useful, misses important information.
3 - Acceptable. Addresses the request but could be more complete or precise.
4 - Good. Useful, accurate, and mostly complete.
5 - Excellent. Highly useful, complete, accurate, and well aligned with the backend result.`;

const READABILITY_RUBRIC = `
Readability measures how easy the answer is to understand (1–5):
1 - Very difficult to understand.
2 - Confusing, awkward, or poorly structured.
3 - Understandable, but not especially clear or concise.
4 - Clear and easy to follow.
5 - Very clear, concise, natural, and well structured.`;

function buildEvaluationPrompt({ prompt, intent, mcpResult, naturalText }) {
  const resultSummary = JSON.stringify(mcpResult || {}).slice(0, 800);
  return `You are an evaluator for an AI production workflow assistant. Evaluate the assistant response below.

User prompt: "${prompt}"
Action executed: ${intent}
Backend result (summary): ${resultSummary}
Assistant answer: "${naturalText}"

${QUALITY_RUBRIC}
${READABILITY_RUBRIC}

Also check faithfulness: did the assistant accurately reflect the backend result without inventing data?

Return ONLY valid JSON, no markdown, no explanation:
{
  "qualityScoreAuto": <1-5>,
  "readabilityScoreAuto": <1-5>,
  "faithfulToMcpResult": <true|false>,
  "evaluatorReason": "<one sentence explanation>"
}`;
}

function extractEvalJson(text) {
  const clean = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(clean); } catch {
    const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try { return JSON.parse(clean.slice(start, end + 1)); } catch { return null; }
  }
}

async function evaluateWithOllama(prompt) {
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
        format: "json",
        options: { temperature: 0 },
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    return extractEvalJson(data.message?.content);
  } finally { clearTimeout(timeout); }
}

async function evaluateWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
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
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a strict JSON evaluator. Return only valid JSON." },
          { role: "user", content: prompt }
        ]
      })
    });
    const data = await response.json();
    return extractEvalJson(data.choices?.[0]?.message?.content);
  } finally { clearTimeout(timeout); }
}

export async function evaluateResponse({ prompt, intent, mcpResult, naturalText, provider }) {
  if (!naturalText) return null;
  const evalPrompt = buildEvaluationPrompt({ prompt, intent, mcpResult, naturalText });
  try {
    const result = provider === "openai"
      ? await evaluateWithOpenAI(evalPrompt)
      : await evaluateWithOllama(evalPrompt);
    if (!result) return null;
    return {
      qualityScoreAuto: Number(result.qualityScoreAuto) || null,
      readabilityScoreAuto: Number(result.readabilityScoreAuto) || null,
      faithfulToMcpResult: result.faithfulToMcpResult === true || result.faithfulToMcpResult === "true",
      evaluatorReason: result.evaluatorReason || ""
    };
  } catch { return null; }
}
