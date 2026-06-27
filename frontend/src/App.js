import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/styles/App.css";

import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/routes";

// Layouts
import AppShell from "@/layouts/AppShell";

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Repos from "@/pages/Repos";
import RepoConnect from "@/pages/RepoConnect";
import PipelineGenerator from "@/pages/PipelineGenerator";
import Pipelines from "@/pages/Pipelines";
import PipelineDetail from "@/pages/PipelineDetail";
import RunDetail from "@/pages/RunDetail";
import Deployments from "@/pages/Deployments";
import Security from "@/pages/Security";
import Settings from "@/pages/Settings";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-zinc-500 font-mono">
        <span className="ascii-loader" /> <span className="ml-2">authenticating…</span>
      </div>
    );
  }
  if (!user) return <Navigate to={ROUTES.login} replace />;
  return children;
}

function Router() {
  const location = useLocation();
  // CRITICAL: process Emergent session_id BEFORE any other routing
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<Landing />} />
      <Route path={ROUTES.login} element={<Login />} />
      <Route path={ROUTES.signup} element={<Signup />} />

      <Route path={ROUTES.app} element={<Protected><AppShell /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="repos" element={<Repos />} />
        <Route path="repos/connect" element={<RepoConnect />} />
        <Route path="pipelines" element={<Pipelines />} />
        <Route path="pipelines/new" element={<PipelineGenerator />} />
        <Route path="pipelines/:id" element={<PipelineDetail />} />
        <Route path="runs/:id" element={<RunDetail />} />
        <Route path="deployments" element={<Deployments />} />
        <Route path="security" element={<Security />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Router />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#000",
                border: "1px solid #262626",
                color: "#EDEDED",
                fontFamily: "IBM Plex Sans, sans-serif",
                borderRadius: "2px",
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
