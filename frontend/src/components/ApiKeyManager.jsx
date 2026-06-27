import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash, Key, ShieldCheck, Globe } from "@phosphor-icons/react";
import api from "@/api/client";
import { fromNow } from "@/utils/formatters";

const MODE_LABEL = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  "openai-compat": "OpenAI-compat (Groq / OpenRouter / LLaMA-3)",
};

const PRESETS = [
  { label: "Groq (LLaMA-3)", mode: "openai-compat", base_url: "https://api.groq.com/openai/v1", default_model: "llama-3.1-70b-versatile" },
  { label: "OpenRouter", mode: "openai-compat", base_url: "https://openrouter.ai/api/v1", default_model: "meta-llama/llama-3.1-70b-instruct" },
  { label: "Together AI (LLaMA-3)", mode: "openai-compat", base_url: "https://api.together.xyz/v1", default_model: "meta-llama/Llama-3-70b-chat-hf" },
  { label: "OpenAI (GPT-4)", mode: "openai", base_url: "", default_model: "gpt-4o" },
  { label: "Anthropic (Claude)", mode: "anthropic", base_url: "", default_model: "claude-3-5-sonnet-20241022" },
];

export default function ApiKeyManager({ onChange }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    label: "",
    mode: "openai-compat",
    api_key: "",
    base_url: "https://api.groq.com/openai/v1",
    default_model: "llama-3.1-70b-versatile",
  });

  const load = async () => {
    try {
      const { data } = await api.get("/api-keys");
      setKeys(data);
      onChange?.(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const applyPreset = (p) => {
    setForm({ label: p.label, mode: p.mode, api_key: "", base_url: p.base_url, default_model: p.default_model });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api-keys", {
        label: form.label,
        mode: form.mode,
        api_key: form.api_key,
        base_url: form.mode === "openai-compat" ? form.base_url : null,
        default_model: form.default_model || null,
      });
      toast.success("API key added");
      setShowAdd(false);
      setForm({ label: "", mode: "openai-compat", api_key: "", base_url: "https://api.groq.com/openai/v1", default_model: "llama-3.1-70b-versatile" });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add key");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this API key?")) return;
    try {
      await api.delete(`/api-keys/${id}`);
      toast.success("Removed");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delete failed");
    }
  };

  return (
    <div data-testid="api-key-manager">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Key size={16} color="#E54D2E" weight="duotone" />
          <h2 className="font-display font-bold">Your AI keys (BYOK)</h2>
          <span className="badge badge-success ml-2">encrypted</span>
        </div>
        <button data-testid="add-api-key-btn" onClick={() => setShowAdd((v) => !v)} className="btn-secondary text-xs inline-flex items-center gap-1">
          <Plus size={12} /> {showAdd ? "Cancel" : "Add key"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={submit} className="border border-[#262626] p-4 mb-4 space-y-3 bg-[#0a0a0a]">
          <div>
            <div className="micro-label mb-1">// presets</div>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  data-testid={`preset-${p.label.replace(/\W+/g, '-').toLowerCase()}`}
                  onClick={() => applyPreset(p)}
                  className="text-[11px] border border-[#262626] px-2 py-1 hover:border-[#E54D2E] text-[#A1A1AA] hover:text-white transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="// label">
              <input data-testid="api-key-label" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input" placeholder="e.g. My Groq key" />
            </Field>
            <Field label="// mode">
              <select data-testid="api-key-mode" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="input">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai-compat">OpenAI-compat (LLaMA-3 / Groq / OpenRouter)</option>
              </select>
            </Field>
          </div>
          <Field label="// api key (stored encrypted)">
            <input data-testid="api-key-value" required type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} className="input font-mono" placeholder="sk-... / gsk_... / claude_..." />
          </Field>
          {form.mode === "openai-compat" && (
            <Field label="// base url">
              <input data-testid="api-key-base-url" required value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} className="input font-mono text-xs" />
            </Field>
          )}
          <Field label="// default model (optional)">
            <input data-testid="api-key-default-model" value={form.default_model} onChange={(e) => setForm({ ...form, default_model: e.target.value })} className="input font-mono text-xs" placeholder="gpt-4o / llama-3.1-70b-versatile / claude-3-5-sonnet-20241022" />
          </Field>
          <button type="submit" data-testid="api-key-save-btn" className="btn-primary text-xs px-4 py-2">Save key</button>
        </form>
      )}

      {loading ? (
        <div className="text-[#71717A] font-mono text-xs"><span className="ascii-loader" /> loading...</div>
      ) : keys.length === 0 ? (
        <div className="border border-dashed border-[#262626] p-6 text-center">
          <ShieldCheck size={24} className="mx-auto text-[#71717A]" />
          <div className="text-xs text-[#A1A1AA] mt-2">No personal keys saved. Forge will use the included Emergent key by default.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} data-testid={`api-key-${k.id}`} className="border border-[#262626] p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#1A1A1A] grid place-items-center border border-[#262626]">
                {k.mode === "openai-compat" ? <Globe size={14} color="#E54D2E" /> : <Key size={14} color="#E54D2E" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{k.label}</span>
                  <span className="badge">{MODE_LABEL[k.mode] || k.mode}</span>
                </div>
                <div className="text-[10px] text-[#71717A] mt-0.5 font-mono">
                  {k.api_key_masked}
                  {k.base_url && <> · {k.base_url}</>}
                  {k.default_model && <> · model: {k.default_model}</>}
                </div>
              </div>
              <div className="text-[10px] text-[#71717A] font-mono">{fromNow(k.created_at)}</div>
              <button onClick={() => remove(k.id)} data-testid={`api-key-delete-${k.id}`} className="text-[#71717A] hover:text-[#E54D2E] p-1">
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <div className="micro-label mb-1">{label}</div>
    {children}
  </div>
);
