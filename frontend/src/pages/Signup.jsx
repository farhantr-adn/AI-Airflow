import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lightning, GoogleLogo, Envelope, Lock, User } from "@phosphor-icons/react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      loginWithToken(data.token, data.user);
      toast.success("Account created");
      navigate("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/app";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#0A0A0A]">
      <div className="hidden lg:block relative border-r border-[#1A1A1A] overflow-hidden">
        <div className="absolute inset-0 crosshair-bg opacity-40" />
        <div className="relative h-full p-12 flex flex-col">
          <Link to="/" data-testid="signup-logo" className="flex items-center gap-2 w-fit">
            <div className="w-7 h-7 bg-[#E54D2E] grid place-items-center"><Lightning weight="fill" size={16} color="#fff" /></div>
            <span className="font-display font-black text-lg tracking-tighter">FORGE</span>
          </Link>
          <div className="flex-1 flex items-center">
            <div>
              <h2 className="font-display font-black text-4xl tracking-tighter leading-tight">
                Join 1,200+ engineers shipping faster.
              </h2>
              <div className="mt-8 space-y-3 text-sm text-[#A1A1AA]">
                {[
                  "AI-generated pipelines in 12 seconds",
                  "Auto-rollback on failed deploys",
                  "Snyk + Trivy scans built in",
                  "Works with any cloud target",
                ].map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <span className="text-[#E54D2E] font-mono">›</span> {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="micro-label">// no credit card required</div>
        </div>
      </div>

      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#E54D2E] grid place-items-center"><Lightning weight="fill" size={16} color="#fff" /></div>
              <span className="font-display font-black text-lg tracking-tighter">FORGE</span>
            </Link>
          </div>
          <h1 className="font-display font-black text-3xl tracking-tighter">Create your account</h1>
          <p className="text-[#A1A1AA] text-sm mt-2">Free during preview. No credit card required.</p>

          <button onClick={googleLogin} data-testid="signup-google-btn" className="mt-8 w-full btn-secondary flex items-center justify-center gap-2 py-3">
            <GoogleLogo size={18} weight="bold" /> Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-[#71717A] text-xs font-mono">
            <div className="flex-1 h-px bg-[#262626]" /> or <div className="flex-1 h-px bg-[#262626]" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <div className="micro-label mb-1.5">Name</div>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-[#71717A]" />
                <input data-testid="signup-name-input" required value={name} onChange={(e) => setName(e.target.value)} className="input pl-9" placeholder="Ada Lovelace" />
              </div>
            </div>
            <div>
              <div className="micro-label mb-1.5">Email</div>
              <div className="relative">
                <Envelope size={16} className="absolute left-3 top-3 text-[#71717A]" />
                <input data-testid="signup-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-9" placeholder="ada@example.com" />
              </div>
            </div>
            <div>
              <div className="micro-label mb-1.5">Password</div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-[#71717A]" />
                <input data-testid="signup-password-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-9" placeholder="min 6 chars" />
              </div>
            </div>
            <button type="submit" disabled={loading} data-testid="signup-submit-btn" className="btn-primary w-full py-3">
              {loading ? <span className="ascii-loader" /> : "Create account →"}
            </button>
          </form>

          <div className="mt-6 text-sm text-[#A1A1AA] text-center">
            Already have one?{" "}
            <Link to="/login" data-testid="signup-to-login" className="text-[#E54D2E] hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
