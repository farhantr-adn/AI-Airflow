/** Pipeline service - includes SSE streaming for AI generation. */
import client, { API } from "./client";

export const pipelineService = {
  list: () => client.get("/pipelines").then((r) => r.data),
  get: (id) => client.get(`/pipelines/${id}`).then((r) => r.data),
  save: (payload) => client.post("/pipelines", payload).then((r) => r.data),
  remove: (id) => client.delete(`/pipelines/${id}`).then((r) => r.data),

  /**
   * Streams generated YAML via SSE. Calls onDelta(chunk) for each text delta,
   * onError(msg) on error, returns full accumulated text when stream completes.
   */
  generateStream: async (payload, { onDelta, onError, signal } = {}) => {
    const token = localStorage.getItem("forge_token");
    const res = await fetch(`${API}/pipelines/generate`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new Error(await res.text());
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() || "";
      for (const ev of events) {
        const line = ev.trim();
        if (!line.startsWith("data:")) continue;
        try {
          const d = JSON.parse(line.slice(5).trim());
          if (d.delta) { full += d.delta; onDelta?.(d.delta); }
          if (d.error) onError?.(d.error);
        } catch (e) { /* ignore parse errors */ }
      }
    }
    return full;
  },
};
