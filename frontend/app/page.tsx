"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  ShieldCheck,
  Headphones,
  FileText,
  Activity,
  Database,
  Layers,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  LogIn,
  LogOut,
  User,
  ShieldAlert,
  BarChart3,
  FlaskConical,
} from "lucide-react";
import { useAuth } from "../context/auth-context";
import { authApi } from "../lib/api";

// Bug #31 fix: Use NEXT_PUBLIC_API_URL so health check works in Docker/production
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface HealthData {
  service: string;
  status: string;
  timestamp: string;
  uptime: number;
  database: {
    status: string;
    database: string;
    details?: string;
  };
  version: string;
  environment: string;
}

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"customer" | "agent" | "admin">("customer");

  // RBAC test states
  const [rbacResult, setRbacResult] = useState<{
    endpoint: string;
    status: "success" | "forbidden" | "unauthorized" | null;
    message: string;
  } | null>(null);
  const [testingRbac, setTestingRbac] = useState<boolean>(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const testRbac = async (type: "admin" | "agent") => {
    setTestingRbac(true);
    setRbacResult(null);
    try {
      const res =
        type === "admin"
          ? await authApi.testAdminOnly()
          : await authApi.testAgentOnly();
      setRbacResult({
        endpoint: `/api/auth/${type}-only-test`,
        status: "success",
        message: `${res.message} (Role: ${res.user.role})`,
      });
    } catch (err: any) {
      const isForbidden = err.message.toLowerCase().includes("access denied") || err.message.includes("403");
      setRbacResult({
        endpoint: `/api/auth/${type}-only-test`,
        status: isForbidden ? "forbidden" : "unauthorized",
        message: err.message,
      });
    } finally {
      setTestingRbac(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  AutoSupport AI
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                  Phase 3 Verified
                </span>
              </div>
              <p className="text-xs text-slate-400">Enterprise AI Support & RAG Escalation</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Customer Chat</span>
            </Link>
            <Link
              href="/agent"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-white px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Agent Inbox</span>
            </Link>
            <Link
              href="/admin"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 transition-all"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Knowledge Base</span>
            </Link>
            <Link
              href="/admin/analytics"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-pink-300 hover:text-white px-3 py-1.5 rounded-lg bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </Link>
            <Link
              href="/admin/eval"
              className="hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-white px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>AI Benchmark</span>
            </Link>
            <a
              href="http://localhost:4000/api/docs"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Swagger Docs</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {/* Health pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  health
                    ? health.database.database === "connected"
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-amber-400"
                    : "bg-rose-400"
                }`}
              />
              <span className="text-slate-300">
                {loading && !health
                  ? "Probing API..."
                  : health
                  ? health.database.database === "connected"
                    ? "API & DB Online"
                    : "API Ready (DB Awaiting)"
                  : "Backend Offline"}
              </span>
              <button
                onClick={fetchHealth}
                title="Refresh Status"
                className="text-slate-400 hover:text-white transition-colors ml-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* User Session Profile / Auth Links */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-white leading-tight">{user.name}</p>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        user.role === "ADMIN"
                          ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                          : user.role === "AGENT"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/60 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <section className="text-center space-y-4 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phase 2 Verified • Argon2/Bcrypt + JWT Sessions + Strict RBAC Guards</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            AI Customer Support{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Automation Platform
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            Enterprise Generative AI support platform with cryptographic session security, role-based authorization,
            and grounded knowledge retrieval.
          </p>
        </section>

        {/* Live RBAC Guard Interactive Tester */}
        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-6 backdrop-blur-sm shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Live Role-Based Access Control (RBAC) Tester</h2>
                <p className="text-xs text-slate-400">
                  Verify that backend guards strictly reject unauthorized personas (403 Forbidden) and allow authorized roles
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                Current Role:{" "}
                <span className="font-bold text-white">
                  {isAuthenticated && user ? user.role : "Unauthenticated (Guest)"}
                </span>
              </span>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => testRbac("admin")}
                disabled={testingRbac}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 text-pink-300 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Test Admin Guard (`GET /api/auth/admin-only-test`)</span>
              </button>
              <button
                onClick={() => testRbac("agent")}
                disabled={testingRbac}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Test Agent Guard (`GET /api/auth/agent-only-test`)</span>
              </button>
            </div>

            {rbacResult && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                  rbacResult.status === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : rbacResult.status === "forbidden"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {rbacResult.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    Endpoint Tested: <code>{rbacResult.endpoint}</code> •{" "}
                    {rbacResult.status === "success"
                      ? "200 Authorized"
                      : rbacResult.status === "forbidden"
                      ? "403 Forbidden (RBAC Guard Enforced)"
                      : "401 Unauthorized"}
                  </div>
                  <div className="text-[11px] mt-1 opacity-90">{rbacResult.message}</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Live System Status Banner */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <Activity className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">System Infrastructure Status</h2>
                <p className="text-xs text-slate-400">Real-time status of backend service and PostgreSQL database</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchHealth}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Re-check Connection</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Backend Gateway</span>
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                <span>{health ? "NestJS API :4000" : "Offline"}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Modular monolith REST server</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Auth System</span>
                <ShieldCheck className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Bcrypt + JWT (7d)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">HTTP-only cookie + Bearer</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>API Docs (OpenAPI)</span>
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Swagger 8.0</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                <a
                  href="http://localhost:4000/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  /api/docs
                </a>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Database</span>
                <Database className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health?.database.database === "connected"
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`}
                />
                <span>
                  {health
                    ? health.database.database === "connected"
                      ? "Connected"
                      : "Config Ready"
                    : "Unreachable"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">PostgreSQL 16 + pgvector</p>
            </div>
          </div>
        </section>

        {/* Three User Role Dashboards Preview */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">System Architecture & Role Workflows</h2>
              <p className="text-xs text-slate-400">
                The platform strictly enforces role-based access control across three user personas
              </p>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start">
              <button
                onClick={() => setActiveTab("customer")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "customer"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Customer Chat
              </button>
              <button
                onClick={() => setActiveTab("agent")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "agent"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Support Agent
              </button>
              <button
                onClick={() => setActiveTab("admin")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "admin"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Admin & KB
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Customer Box */}
            <div
              className={`p-6 rounded-2xl border transition-all ${
                activeTab === "customer"
                  ? "border-indigo-500/50 bg-slate-900/70 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                  : "border-slate-800 bg-slate-900/30 opacity-70 hover:opacity-100"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Customer Persona</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Interacts with the AI assistant, receives source-cited answers from verified company docs, and escalates when human review is needed.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Persistent conversation sessions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>RAG answers with page & doc citations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Explicit Human Escalation trigger</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Response rating & feedback collection</span>
                </li>
              </ul>
            </div>

            {/* Support Agent Box */}
            <div
              className={`p-6 rounded-2xl border transition-all ${
                activeTab === "agent"
                  ? "border-purple-500/50 bg-slate-900/70 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30"
                  : "border-slate-800 bg-slate-900/30 opacity-70 hover:opacity-100"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Support Agent Persona</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Receives escalated tickets with full context, AI conversation summaries, and relevant doc chunks to resolve customer issues fast.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Real-time ticket queue with priority tags</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>AI-generated conversation synopsis</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Claim, re-assign, and resolve tickets</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Complete audit log & resolution notes</span>
                </li>
              </ul>
            </div>

            {/* Administrator Box */}
            <div
              className={`p-6 rounded-2xl border transition-all ${
                activeTab === "admin"
                  ? "border-pink-500/50 bg-slate-900/70 shadow-lg shadow-pink-500/10 ring-1 ring-pink-500/30"
                  : "border-slate-800 bg-slate-900/30 opacity-70 hover:opacity-100"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Administrator Persona</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Manages knowledge documents (PDF & Text), monitors chunking and vector indexing, tracks escalation trends, and evaluates AI quality.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>Document upload, chunking & embeddings</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>pgvector semantic search management</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>Real database-backed analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>Prompt-injection guardrails & audit</span>
                </li>
              </ul>

              <div className="pt-4 mt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
                <Link
                  href="/admin"
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Knowledge Base</span>
                </Link>
                <Link
                  href="/admin/analytics"
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium text-xs shadow-md shadow-pink-600/20 transition-all"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Live Analytics</span>
                </Link>
                <Link
                  href="/admin/eval"
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-md shadow-purple-600/20 transition-all"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>AI Benchmark</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        AutoSupport AI • Built for Placement Interviews • Phase 2 Authentication & RBAC Verified
      </footer>
    </div>
  );
}
