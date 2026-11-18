"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Headphones,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  User,
  MessageSquare,
  FileText,
  RefreshCw,
  Send,
  AlertCircle,
  Tag,
  Check,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/auth-context";
import { Ticket, ticketsApi, conversationsApi } from "../../lib/api";

export default function AgentInboxPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [agentReply, setAgentReply] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");

  const loadTickets = async (filter?: string) => {
    setLoading(true);
    try {
      const data = await ticketsApi.getAll(filter || undefined);
      setTickets(data);
      if (data.length > 0) {
        loadTicketDetails(data[0].id);
      } else {
        setSelectedTicket(null);
      }
    } catch (err: any) {
      console.error("Failed to load tickets", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetails = async (id: string) => {
    try {
      const ticket = await ticketsApi.getById(id);
      setSelectedTicket(ticket);
      setResolutionNotes(ticket.resolutionNotes || "");
    } catch (err: any) {
      console.error("Failed to load ticket details", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadTickets(statusFilter);
    }
  }, [isAuthenticated, statusFilter]);

  const handleUpdateStatus = async (status: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED") => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      const updated = await ticketsApi.update(selectedTicket.id, {
        status,
        resolutionNotes: resolutionNotes || undefined,
      });
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, status: updated.status } : t)));
    } catch (err: any) {
      alert("Failed to update ticket: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleClaimTicket = async () => {
    if (!selectedTicket || !user) return;
    setUpdating(true);
    try {
      const updated = await ticketsApi.claim(selectedTicket.id);
      setSelectedTicket(updated);
      setTickets((prev) =>
        prev.map((t) =>
          t.id === updated.id
            ? { ...t, assignedAgentId: user.id, status: "IN_PROGRESS", assignedAgent: user }
            : t,
        ),
      );
    } catch (err: any) {
      alert("Failed to claim ticket: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendAgentReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !agentReply.trim()) return;
    setUpdating(true);
    try {
      const updated = await ticketsApi.reply(selectedTicket.id, agentReply.trim());
      setAgentReply("");
      setSelectedTicket(updated);
      setTickets((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, status: updated.status } : t)),
      );
    } catch (err: any) {
      alert("Failed to send reply: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      const updated = await ticketsApi.resolve(
        selectedTicket.id,
        resolutionNotes || "Issue resolved by customer support representative.",
      );
      setSelectedTicket(updated);
      setTickets((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, status: "RESOLVED" } : t)),
      );
    } catch (err: any) {
      alert("Failed to resolve ticket: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Checking agent credentials...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
          <Headphones className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Support Agent Authentication Required</h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Sign in with an Agent or Administrator account to access the escalation queue and tickets.
        </p>
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-lg shadow-purple-600/30 transition-all"
        >
          Sign In to Agent Portal
        </Link>
      </div>
    );
  }

  // Bug #11 fix: Frontend RBAC guard — customers should not access the agent inbox
  if (user?.role === "CUSTOMER") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          This page is restricted to Support Agents and Administrators. Your role is <span className="text-rose-300 font-semibold">{user.role}</span>.
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

  // Count metrics
  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const inProgressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Back to Platform Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <Headphones className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Support Agent Inbox</span>
              <span className="text-[10px] text-purple-400 ml-2">Phase 3 Escalation Dashboard</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Customer Chat View</span>
          </Link>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Agent: <span className="font-semibold text-white">{user?.name}</span> ({user?.role})
          </span>
        </div>
      </header>

      {/* Metrics Strip */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/30 px-6 flex items-center justify-between shrink-0 overflow-x-auto text-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total in View:</span>
            <span className="font-bold text-white">{tickets.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">Open Triage:</span>
            <span className="font-bold text-amber-400">{openCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-slate-400">In Progress:</span>
            <span className="font-bold text-indigo-400">{inProgressCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">Resolved:</span>
            <span className="font-bold text-emerald-400">{resolvedCount}</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1">
          {["", "OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"].map((st) => (
            <button
              key={st || "all"}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                statusFilter === st
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {st || "All Tickets"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace: Tickets List + Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tickets List */}
        <aside className="w-80 sm:w-96 border-r border-slate-800 bg-slate-900/20 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Ticket Queue</span>
            <button
              onClick={() => loadTickets(statusFilter)}
              title="Refresh Queue"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading queue...</div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/40" />
                <p className="font-medium text-slate-400">All caught up!</p>
                <p className="text-[11px]">No support tickets match the current filter.</p>
              </div>
            ) : (
              tickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                const priorityColor =
                  t.priority === "URGENT" || t.priority === "HIGH"
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                    : t.priority === "MEDIUM"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-slate-700/40 text-slate-400 border-slate-600/30";

                return (
                  <button
                    key={t.id}
                    onClick={() => loadTicketDetails(t.id)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                      isSelected
                        ? "bg-slate-800/90 border-purple-500/50 shadow-md shadow-purple-500/5"
                        : "bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${priorityColor}`}>
                        {t.priority}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                          t.status === "OPEN"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : t.status === "IN_PROGRESS"
                            ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <h4 className="font-semibold text-xs text-white line-clamp-1 mb-1">{t.subject}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {t.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/60">
                      <span>Customer: {t.customer?.name || "Guest"}</span>
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right: Ticket Details & Action Panel */}
        <section className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {!selectedTicket ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Select a ticket from the queue to view full transcript & take action</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Ticket Headline Banner */}
              <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/40 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-400">#{selectedTicket.id.slice(0, 8)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      Category: {selectedTicket.category}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        selectedTicket.status === "OPEN"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : selectedTicket.status === "IN_PROGRESS"
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {selectedTicket.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!selectedTicket.assignedAgentId && (
                      <button
                        onClick={handleClaimTicket}
                        disabled={updating}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Claim Ticket</span>
                      </button>
                    )}
                    {selectedTicket.status !== "RESOLVED" && (
                      <button
                        onClick={handleResolveTicket}
                        disabled={updating}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Resolved</span>
                      </button>
                    )}
                  </div>
                </div>

                <h2 className="text-lg font-bold text-white mb-1">{selectedTicket.subject}</h2>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-3">
                  {selectedTicket.description}
                </p>

                {/* Phase 6 AI Conversation Synopsis & Recommendation Card */}
                {selectedTicket.conversationSummary && (
                  <div className="mb-3 p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs space-y-2 shadow-lg shadow-purple-950/20">
                    <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>AI Conversation Synopsis & Triage Recommendation</span>
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap font-mono text-[11px] leading-relaxed bg-slate-950/70 p-3 rounded-lg border border-purple-500/20">
                      {selectedTicket.conversationSummary}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <div>Customer: <span className="text-slate-200 font-medium">{selectedTicket.customer?.name}</span> ({selectedTicket.customer?.email})</div>
                  <div>Assigned Agent: <span className="text-slate-200 font-medium">{selectedTicket.assignedAgent?.name || "Unassigned"}</span></div>
                  <div>Created: <span className="text-slate-200 font-medium">{new Date(selectedTicket.createdAt).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Scrollable Transcript & Resolution Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Conversation Transcript */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Customer Conversation Transcript</span>
                  </h3>

                  <div className="space-y-3 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/80">
                    {selectedTicket.conversation?.messages && selectedTicket.conversation.messages.length > 0 ? (
                      selectedTicket.conversation.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-3 rounded-xl text-xs max-w-xl ${
                            m.sender === "CUSTOMER"
                              ? "bg-indigo-950/40 border border-indigo-500/20 text-indigo-200 ml-auto"
                              : m.sender === "AGENT"
                              ? "bg-purple-950/40 border border-purple-500/20 text-purple-200 mr-auto"
                              : "bg-slate-800/60 text-slate-300 mr-auto"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-60 mb-1">
                            <span className="font-semibold">{m.sender}</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No messages found in linked conversation.</p>
                    )}
                  </div>
                </div>

                {/* Agent Reply Box */}
                {selectedTicket.conversationId && selectedTicket.status !== "RESOLVED" && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-purple-400" />
                      <span>Reply directly to customer thread</span>
                    </h3>
                    <form onSubmit={handleSendAgentReply} className="flex gap-2">
                      <input
                        type="text"
                        value={agentReply}
                        onChange={(e) => setAgentReply(e.target.value)}
                        placeholder="Write a message to the customer..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={updating || !agentReply.trim()}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all disabled:opacity-50"
                      >
                        Send Reply
                      </button>
                    </form>
                  </div>
                )}

                {/* Resolution Notes */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Resolution Record & Internal Notes</span>
                  </h3>
                  <textarea
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Enter diagnostic steps taken, refund IDs, or replacement tracking numbers..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket.status)}
                      disabled={updating}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
