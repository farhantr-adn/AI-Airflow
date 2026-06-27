import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lightning, GoogleLogo, Envelope, Lock } from "@phosphor-icons/react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      loginWithToken(data.token, data.user);
      toast.success("Welcome back");
      navigate("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
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
      {/* Left brand panel */}
      <div className="hidden lg:block relative border-r border-[#1A1A1A] overflow-hidden">
        <div className="absolute inset-0 crosshair-bg opacity-40" />
        <div className="relative h-full p-12 flex flex-col">
          <Link to="/" data-testid="login-logo" className="flex items-center gap-2 w-fit">
            <div className="w-7 h-7 bg-[#E54D2E] grid place-items-center"><Lightning weight="fill" size={16} color="#fff" /></div>
            <span className="font-display font-black text-lg tracking-tighter">FORGE</span>
          </Link>
          <div className="flex-1 grid place-items-center">
            <div className="font-mono text-xs space-y-2 text-[#71717A]">
              <div className="text-[#A1A1AA]">$ forge auth</div>
              <div>→ verifying credentials...</div>
              <div className="text-[#46A758]">→ session established</div>
              <div>→ welcome back, <span className="text-white">engineer</span><span className="blink">_</span></div>
            </div>
          </div>
          <div className="micro-label">// secure auth · zero-trust</div>
        </div>
      </div>

      {/* Right form */}
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#E54D2E] grid place-items-center"><Lightning weight="fill" size={16} color="#fff" /></div>
              <span className="font-display font-black text-lg tracking-tighter">FORGE</span>
            </Link>
          </div>
          <h1 className="font-display font-black text-3xl tracking-tighter">Sign in to Forge</h1>
          <p className="text-[#A1A1AA] text-sm mt-2">Continue shipping at terminal velocity.</p>

          <button onClick={googleLogin} data-testid="login-google-btn" className="mt-8 w-full btn-secondary flex items-center justify-center gap-2 py-3">
            <GoogleLogo size={18} weight="bold" /> Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-[#71717A] text-xs font-mono">
            <div className="flex-1 h-px bg-[#262626]" /> or <div className="flex-1 h-px bg-[#262626]" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <div className="micro-label mb-1.5">Email</div>
              <div className="relative">
                <Envelope size={16} className="absolute left-3 top-3 text-[#71717A]" />
                <input
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="engineer@company.com"
                />
              </div>
            </div>
            <div>
              <div className="micro-label mb-1.5">Password</div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-[#71717A]" />
                <input
                  data-testid="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} data-testid="login-submit-btn" className="btn-primary w-full py-3">
              {loading ? <span className="ascii-loader" /> : "Sign in →"}
            </button>
          </form>

          <div className="mt-6 text-sm text-[#A1A1AA] text-center">
            No account?{" "}
            <Link to="/signup" data-testid="login-to-signup" className="text-[#E54D2E] hover:underline">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
