"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Target,
  BarChart3,
  Database,
  Headphones,
  Search,
  Filter,
  Check,
  X,
  Play,
  FileText,
} from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import {
  EvaluationReport,
  EvaluationTestCase,
  evalApi,
} from "../../../lib/api";

export default function AiEvaluationPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [dataset, setDataset] = useState<EvaluationTestCase[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [loadingDataset, setLoadingDataset] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PASS" | "FAIL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const loadInitialDataset = async () => {
    setLoadingDataset(true);
    try {
      const data = await evalApi.getDataset();
      setDataset(data);
    } catch (err: any) {
      console.error("Failed to load evaluation dataset", err);
    } finally {
      setLoadingDataset(false);
    }
  };

  const handleRunEvaluation = async () => {
    setRunning(true);
    try {
      const res = await evalApi.runEvaluation();
      setReport(res);
    } catch (err: any) {
      alert("Evaluation run failed: " + err.message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialDataset();
    }
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Checking administrator credentials...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
          <Target className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          AI Evaluation Suite Authentication Required
        </h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Sign in with an Administrator account to run model benchmarks and evaluate accuracy across the golden dataset.
        </p>
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all"
        >
          Sign In as Admin
        </Link>
      </div>
    );
  }

  // Filter results
  const filteredResults = report?.detailedResults.filter((r) => {
    if (statusFilter === "PASS" && !r.passed) return false;
    if (statusFilter === "FAIL" && r.passed) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    return true;
  }) || [];

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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">
                AI Model Quality & Benchmark Studio
              </span>
              <span className="text-[10px] text-purple-400 font-mono ml-2">
                Phase 8 Evaluation Suite
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/analytics"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/30 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </Link>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Knowledge Base</span>
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Benchmark Banner & Trigger */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h1 className="text-base font-bold text-white">
                Golden Evaluation Benchmark (28 Test Cases)
              </h1>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Executes end-to-end evaluation queries measuring intent classification accuracy, high-urgency escalation recall, adversarial prompt-injection defenses, and inference latency against the active AI provider.
            </p>
          </div>

          <button
            onClick={handleRunEvaluation}
            disabled={running}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 shrink-0"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Benchmark Telemetry...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Full AI Evaluation Benchmark</span>
              </>
            )}
          </button>
        </div>

        {/* Benchmark Summary KPI Metrics */}
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-purple-500/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Overall Accuracy</p>
                <p className="text-2xl font-extrabold text-white font-mono">
                  {report.summary.overallAccuracyPercentage}%
                </p>
                <p className="text-[10px] text-emerald-400">
                  {report.summary.passedCases} of {report.summary.totalTestCases} passed
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-rose-500/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Escalation Recall</p>
                <p className="text-2xl font-extrabold text-rose-300 font-mono">
                  {report.summary.escalationRecallPercentage}%
                </p>
                <p className="text-[10px] text-slate-400">
                  Critical safety trigger rate
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-indigo-500/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Average Latency</p>
                <p className="text-2xl font-extrabold text-indigo-300 font-mono">
                  {report.summary.averageLatencyMs} ms
                </p>
                <p className="text-[10px] text-slate-400">
                  Inference speed per query
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-emerald-500/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Evaluated Provider</p>
                <p className="text-sm font-bold text-emerald-400 font-mono truncate max-w-[130px]">
                  {report.summary.evaluatedProvider}
                </p>
                <p className="text-[10px] text-slate-400">
                  Active model engine
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Category Breakdown Table */}
        {report && (
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Accuracy by Inquiry Category
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {report.categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  onClick={() =>
                    setCategoryFilter(categoryFilter === cat.category ? "" : cat.category)
                  }
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    categoryFilter === cat.category
                      ? "bg-purple-950/40 border-purple-500/50 shadow-md ring-1 ring-purple-500/40"
                      : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white truncate max-w-[150px]">
                      {cat.category}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        cat.accuracyPercentage >= 90
                          ? "text-emerald-400"
                          : cat.accuracyPercentage >= 70
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {cat.accuracyPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${
                        cat.accuracyPercentage >= 90
                          ? "bg-emerald-500"
                          : cat.accuracyPercentage >= 70
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${cat.accuracyPercentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    {cat.passed} / {cat.total} passed
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Case Explorer */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-sm text-white">
                {report ? "Benchmark Test Case Results" : "Golden Evaluation Dataset (28 Cases)"}
              </h2>
              <p className="text-xs text-slate-400">
                {report
                  ? `Showing ${filteredResults.length} of ${report.detailedResults.length} evaluation cases`
                  : `Curated standard dataset preview (${dataset.length} test cases)`}
              </p>
            </div>

            {report && (
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      statusFilter === "ALL"
                        ? "bg-purple-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All ({report.detailedResults.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("PASS")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      statusFilter === "PASS"
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Passed ({report.summary.passedCases})
                  </button>
                  <button
                    onClick={() => setStatusFilter("FAIL")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      statusFilter === "FAIL"
                        ? "bg-rose-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Failed ({report.summary.failedCases})
                  </button>
                </div>

                {categoryFilter && (
                  <button
                    onClick={() => setCategoryFilter("")}
                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Clear Filter ({categoryFilter}) ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Test Case Cards List */}
          <div className="space-y-3">
            {!report ? (
              // Pre-run Dataset Preview
              dataset.map((tc) => (
                <div
                  key={tc.id}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-purple-400 font-bold text-[11px]">
                        {tc.id}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium text-[10px]">
                        {tc.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-400">
                        Expected Intent: <strong className="text-white">{tc.expectedIntent}</strong>
                      </span>
                      {tc.expectedRequiresEscalation && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Escalates
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-white font-medium text-xs leading-relaxed">
                    &ldquo;{tc.query}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-500 italic">
                    Notes: {tc.notes}
                  </p>
                </div>
              ))
            ) : filteredResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No test cases match the selected status or category filter.
              </div>
            ) : (
              // Evaluated Results Cards
              filteredResults.map((res) => (
                <div
                  key={res.id}
                  className={`p-4 rounded-xl border text-xs space-y-2.5 transition-all ${
                    res.passed
                      ? "bg-slate-950/80 border-emerald-500/30"
                      : "bg-rose-950/20 border-rose-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          res.passed
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {res.passed ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>PASS</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            <span>FAIL</span>
                          </>
                        )}
                      </span>
                      <span className="font-mono text-slate-400 font-bold text-[11px]">
                        {res.id}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {res.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                      <span>{Math.round(res.confidenceScore * 100)}% Confidence</span>
                      <span>{res.latencyMs}ms</span>
                    </div>
                  </div>

                  <p className="text-white font-medium text-xs leading-relaxed">
                    &ldquo;{res.query}&rdquo;
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1 border-t border-slate-800/80 text-slate-400">
                    <div>
                      Expected Intent: <strong className="text-slate-200">{res.expectedIntent}</strong>
                    </div>
                    <div>
                      Predicted Intent:{" "}
                      <strong
                        className={
                          res.expectedIntent === res.predictedIntent
                            ? "text-emerald-400"
                            : "text-rose-400 underline"
                        }
                      >
                        {res.predictedIntent}
                      </strong>
                    </div>
                    {res.expectedRequiresEscalation && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                        Escalation Required
                      </span>
                    )}
                  </div>

                  {res.failureReason && (
                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-mono">
                      Reason: {res.failureReason}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
