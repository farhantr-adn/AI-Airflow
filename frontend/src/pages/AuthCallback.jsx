import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    // CRITICAL: prevent double-processing in StrictMode
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      navigate("/login", { replace: true });
      return;
    }
    const session_id = m[1];

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        // remove hash and navigate
        window.history.replaceState({}, "", window.location.pathname);
        setUser(data.user);
        navigate("/app", { replace: true });
      } catch {
        navigate("/login?error=oauth", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen grid place-items-center bg-[#0A0A0A] text-[#A1A1AA] font-mono">
      <div className="text-center space-y-2">
        <div className="text-sm"><span className="ascii-loader" /> establishing session...</div>
        <div className="micro-label">// verifying google auth</div>
      </div>
    </div>
  );
}
