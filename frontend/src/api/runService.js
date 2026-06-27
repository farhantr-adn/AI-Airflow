/** Pipeline runs service + AutoFix SSE. */
import client, { API } from "./client";

export const runService = {
  startRun: (pipelineId) => client.post(`/pipelines/${pipelineId}/run`).then((r) => r.data),
  listForPipeline: (pipelineId) => client.get(`/pipelines/${pipelineId}/runs`).then((r) => r.data),
  get: (runId) => client.get(`/runs/${runId}`).then((r) => r.data),
  listAll: () => client.get("/runs").then((r) => r.data),

  autoFixStream: async (runId, { model, provider } = {}, { onDelta, onError, signal } = {}) => {
    const token = localStorage.getItem("forge_token");
    const res = await fetch(`${API}/runs/${runId}/autofix`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-5-20250929",
        provider: provider || "anthropic",
      }),
      signal,
    });
    if (!res.ok) throw new Error(await res.text());
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() || "";
      for (const ev of events) {
        if (!ev.trim().startsWith("data:")) continue;
        try {
          const d = JSON.parse(ev.trim().slice(5).trim());
          if (d.delta) onDelta?.(d.delta);
          if (d.error) onError?.(d.error);
        } catch (e) { /* ignore */ }
      }
    }
  },
};
