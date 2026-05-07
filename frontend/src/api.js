const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.interpreted?.message || "Request failed.");
  }

  return data;
}

export const api = {
  login: (body) => request("/auth/login", { method: "POST", body }),
  dashboard: () => request("/dashboard"),
  products: () => request("/products"),
  runCommand: (body, token) => request("/ai/commands", { method: "POST", body, token })
};
