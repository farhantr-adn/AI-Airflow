import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GithubLogo, GitlabLogo, Code as BitbucketLogo, ArrowLeft, Link as LinkIcon, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import api from "@/lib/api";

const providers = [
  { id: "github", name: "GitHub", icon: GithubLogo, real: true, desc: "Real public-repo fetching via GitHub API" },
  { id: "gitlab", name: "GitLab", icon: GitlabLogo, real: false, desc: "MOCKED OAuth — paste URL" },
  { id: "bitbucket", name: "Bitbucket", icon: BitbucketLogo, real: false, desc: "MOCKED OAuth — paste URL" },
];

export default function RepoConnect() {
  const [provider, setProvider] = useState("github");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/repos/connect", { provider, url });
      toast.success(`Connected ${data.full_name}`);
      navigate("/app/repos");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  const mockOAuth = async (prov) => {
    setOauthLoading(true);
    try {
      const { data } = await api.post(`/repos/oauth-mock/${prov}`);
      toast.success(`Imported ${data.length} repos via ${prov} (mocked)`);
      navigate("/app/repos");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "OAuth failed");
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/app/repos" className="text-xs text-[#71717A] hover:text-white inline-flex items-center gap-1"><ArrowLeft size={12} /> back to repos</Link>
      <header>
        <div className="micro-label mb-2">// integration</div>
        <h1 className="font-display font-black text-4xl tracking-tighter">Connect a repository</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">Paste a public GitHub URL for real analysis, or use mocked OAuth for GitLab/Bitbucket.</p>
      </header>

      {/* Provider tabs */}
      <div className="grid grid-cols-3 gap-px bg-[#262626] border border-[#262626]">
        {providers.map((p) => {
          const active = provider === p.id;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              data-testid={`provider-${p.id}`}
              onClick={() => setProvider(p.id)}
              className={`bg-[#0A0A0A] p-5 text-left transition-colors ${active ? "border-l-2 border-[#E54D2E]" : ""}`}
            >
              <div className="flex items-center gap-3">
                <Icon size={24} weight="duotone" color={active ? "#E54D2E" : "#A1A1AA"} />
                <div className="font-display font-bold">{p.name}</div>
              </div>
              <div className="micro-label mt-3">{p.real ? "// real" : "// mocked"}</div>
              <div className="text-xs text-[#71717A] mt-1">{p.desc}</div>
            </button>
          );
        })}
      </div>

      {/* URL paste */}
      <form onSubmit={submit} className="surface p-6 space-y-4">
        <div>
          <div className="micro-label mb-2">// public repo url</div>
          <div className="relative">
            <LinkIcon size={16} className="absolute left-3 top-3 text-[#71717A]" />
            <input
              data-testid="repo-connect-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="input pl-9"
              placeholder={provider === "github" ? "https://github.com/vercel/next.js" : `https://${provider}.com/owner/repo`}
            />
          </div>
          {provider === "github" && (
            <div className="text-xs text-[#71717A] mt-2">
              ✓ We&apos;ll fetch metadata + languages + root tree from GitHub&apos;s public API. No auth required.
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} data-testid="repo-connect-submit" className="btn-primary inline-flex items-center gap-2">
            {loading ? <span className="ascii-loader" /> : <><Lightning size={14} weight="fill" /> Connect</>}
          </button>
          {provider !== "github" && (
            <button type="button" onClick={() => mockOAuth(provider)} disabled={oauthLoading} data-testid={`mock-oauth-${provider}`} className="btn-secondary">
              {oauthLoading ? <span className="ascii-loader" /> : `Use ${provider} OAuth (mocked)`}
            </button>
          )}
        </div>
      </form>

      <div className="surface-panel p-5 font-mono text-xs text-[#71717A] space-y-1">
        <div className="text-[#A1A1AA]">// try one of these:</div>
        <button onClick={() => setUrl("https://github.com/vercel/next.js")} className="block hover:text-white" data-testid="suggest-1">› https://github.com/vercel/next.js</button>
        <button onClick={() => setUrl("https://github.com/tiangolo/fastapi")} className="block hover:text-white" data-testid="suggest-2">› https://github.com/tiangolo/fastapi</button>
        <button onClick={() => setUrl("https://github.com/golang/go")} className="block hover:text-white" data-testid="suggest-3">› https://github.com/golang/go</button>
      </div>
    </div>
  );
}
