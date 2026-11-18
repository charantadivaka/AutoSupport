"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ShieldCheck,
  Clock,
  Star,
  Users,
  MessageSquare,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  BarChart3,
  PieChart,
  CheckCircle2,
  AlertTriangle,
  Database,
  Headphones,
  Bot,
  ExternalLink,
  FlaskConical,
} from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { AnalyticsOverview, analyticsApi } from "../../../lib/api";

export default function AnalyticsDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const overview = await analyticsApi.getOverview();
      setData(overview);
    } catch (err: any) {
      console.error("Failed to load analytics overview", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalytics();
      const interval = setInterval(() => fetchAnalytics(true), 15000); // Polling every 15s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Checking executive permissions...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          Analytics Dashboard Authentication Required
        </h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Sign in with an Administrator or Agent account to inspect live containment rates, SLA metrics, and CSAT trends.
        </p>
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all"
        >
          Sign In to Dashboard
        </Link>
      </div>
    );
  }

  // Bug #12 fix: Frontend RBAC guard — only AGENT and ADMIN can view analytics
  if (user?.role === "CUSTOMER") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          The Analytics Dashboard is restricted to Agents and Administrators. Your role is <span className="text-rose-300 font-semibold">{user.role}</span>.
        </p>
        <Link
          href="/chat"
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all"
        >
          Go to Customer Chat
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Back to Platform Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">
                Executive Support Analytics
              </span>
              <span className="text-[10px] text-indigo-400 font-mono ml-2">
                Phase 7 Real-Time Telemetry
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAnalytics(true)}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
            title="Refresh Live Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Knowledge Base</span>
          </Link>

          <Link
            href="/admin/eval"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>AI Benchmark</span>
          </Link>

          <Link
            href="/agent"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Agent Inbox</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {loading && !data ? (
          <div className="py-24 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Computing real-time containment and SLA telemetry...
          </div>
        ) : !data ? (
          <div className="py-24 text-center text-xs text-slate-500">
            Failed to load analytics. Please ensure backend service is running.
          </div>
        ) : (
          <>
            {/* Top 4 KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Containment Rate Card */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-indigo-500/30 shadow-lg shadow-indigo-500/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-indigo-300">AI Containment Rate</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      {data.summary.containmentRatePercentage}%
                    </span>
                    <span className="text-xs text-emerald-400 font-medium">Auto-Resolved</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full"
                      style={{ width: `${data.summary.containmentRatePercentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    {data.summary.escalationRatePercentage}% escalated to human agents
                  </p>
                </div>
              </div>

              {/* Resolution SLA Card */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300">Avg Resolution SLA</span>
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      {data.summary.avgResolutionTimeMinutes}
                    </span>
                    <span className="text-xs text-slate-400">minutes</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3">
                    Time from ticket escalation to human resolution
                  </p>
                </div>
              </div>

              {/* CSAT Score Card */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300">Customer CSAT</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Star className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-amber-400 font-mono">
                      {data.csat.averageRating}
                    </span>
                    <span className="text-xs text-slate-400">/ 5.0</span>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-amber-400 text-xs">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={s <= Math.round(data.csat.averageRating) ? "opacity-100" : "opacity-30"}>
                        ★
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      ({data.csat.totalRatings} ratings)
                    </span>
                  </div>
                </div>
              </div>

              {/* Inquiries & Volume Card */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300">Platform Activity</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      {data.summary.totalMessages}
                    </span>
                    <span className="text-xs text-slate-400">messages</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3">
                    Across <strong className="text-white">{data.summary.totalConversations}</strong> conversation sessions • <strong className="text-white">{data.summary.totalTickets}</strong> tickets
                  </p>
                </div>
              </div>
            </div>

            {/* Analysis Grid: Intent Breakdown & CSAT Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Intent Distribution Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-400" />
                    <h2 className="font-bold text-sm text-white">
                      Customer Inquiry Intent Breakdown
                    </h2>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    9-Category AI Classifier
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {data.intentBreakdown.map((item) => (
                    <div key={item.intent} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300">{item.label}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {item.count} queries ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.max(4, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CSAT Distribution Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    <h2 className="font-bold text-sm text-white">
                      CSAT Satisfaction Distribution
                    </h2>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Post-Resolution Ratings
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {[
                    { stars: 5, count: data.csat.distribution.star5, color: "bg-emerald-500" },
                    { stars: 4, count: data.csat.distribution.star4, color: "bg-indigo-500" },
                    { stars: 3, count: data.csat.distribution.star3, color: "bg-amber-500" },
                    { stars: 2, count: data.csat.distribution.star2, color: "bg-orange-500" },
                    { stars: 1, count: data.csat.distribution.star1, color: "bg-rose-500" },
                  ].map((row) => {
                    const total = data.csat.totalRatings || 1;
                    const pct = Math.round((row.count / total) * 100);
                    return (
                      <div key={row.stars} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-300">
                            ★ {row.stars} Stars
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {row.count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                          <div
                            className={`${row.color} h-2 rounded-full transition-all`}
                            style={{ width: `${Math.max(row.count > 0 ? 5 : 0, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Escalations Audit Log Table */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h2 className="font-bold text-sm text-white">
                    Recent Human Escalations & SLA Audit Log
                  </h2>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Live Ticket Triage Feed
                </span>
              </div>

              <div className="overflow-x-auto">
                {data.recentEscalations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No tickets escalated yet. Platform is operating at 100% containment!
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-medium">
                        <th className="pb-2.5">Ticket ID & Subject</th>
                        <th className="pb-2.5">Customer</th>
                        <th className="pb-2.5">Priority</th>
                        <th className="pb-2.5">Status</th>
                        <th className="pb-2.5">SLA Duration</th>
                        <th className="pb-2.5">AI Synopsis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {data.recentEscalations.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3">
                            <p className="font-semibold text-white">{t.subject}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              #{t.id.slice(0, 8)}
                            </p>
                          </td>
                          <td className="py-3">
                            <p className="text-slate-200">{t.customerName}</p>
                            <p className="text-[10px] text-slate-500">{t.customerEmail}</p>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                t.priority === "URGENT" || t.priority === "HIGH"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : t.priority === "MEDIUM"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                t.status === "RESOLVED"
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                  : t.status === "IN_PROGRESS"
                                  ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                  : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-[11px]">
                            {t.durationMinutes !== null ? (
                              <span className="text-emerald-400 font-medium">
                                {t.durationMinutes} min
                              </span>
                            ) : (
                              <span className="text-amber-400 italic">In Queue</span>
                            )}
                          </td>
                          <td className="py-3 max-w-xs">
                            <p className="text-[10px] text-slate-400 line-clamp-2 italic font-mono bg-slate-950/60 p-1.5 rounded border border-slate-800">
                              {t.conversationSummary || "No summary available"}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
