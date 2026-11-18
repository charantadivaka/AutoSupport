"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Plus,
  Headphones,
  User,
  ShieldAlert,
  Clock,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "../../context/auth-context";
import { Conversation, Message, conversationsApi, ticketsApi } from "../../lib/api";

export default function ChatPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputContent, setInputContent] = useState<string>("");
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [escalating, setEscalating] = useState<boolean>(false);
  const [escalationNotice, setEscalationNotice] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [csatRating, setCsatRating] = useState<number>(5);
  const [csatComment, setCsatComment] = useState<string>("");
  const [csatSubmitted, setCsatSubmitted] = useState<boolean>(false);
  const [submittingCsat, setSubmittingCsat] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmitCsat = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticketId = activeConversation?.tickets?.[0]?.id;
    if (!ticketId) return;

    setSubmittingCsat(true);
    try {
      await ticketsApi.submitFeedback(ticketId, csatRating, csatComment);
      setCsatSubmitted(true);
    } catch (err: any) {
      alert("Failed to submit rating: " + err.message);
    } finally {
      setSubmittingCsat(false);
    }
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = async (selectFirst = true) => {
    if (!isAuthenticated) return;
    setLoadingList(true);
    try {
      const data = await conversationsApi.getAll();
      setConversations(data);
      if (selectFirst && data.length > 0) {
        loadConversationDetails(data[0].id);
      } else if (data.length === 0) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (err: any) {
      console.error("Failed to load conversations", err);
    } finally {
      setLoadingList(false);
    }
  };

  const loadConversationDetails = async (id: string) => {
    try {
      const conv = await conversationsApi.getById(id);
      setActiveConversation(conv);
      setMessages(conv.messages || []);
      setEscalationNotice(null);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      console.error("Failed to load conversation details", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStartNewChat = async () => {
    try {
      const newConv = await conversationsApi.create();
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversation(newConv);
      setMessages(newConv.messages || []);
      setEscalationNotice(null);
    } catch (err: any) {
      alert("Failed to create conversation: " + err.message);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputContent;
    if (!textToSend.trim() || sending) return;

    let convId = activeConversation?.id;

    setSending(true);
    setInputContent("");

    try {
      // If no active conversation exists, create one first
      // Bug #3 fix: create() already triggers the full AI pipeline (via initialMessage),
      // and findOne returns all messages including the AI response.
      // We must call loadConversations(false) before returning so the sidebar preview updates.
      if (!convId) {
        const newConv = await conversationsApi.create(textToSend);
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversation(newConv);
        setMessages(newConv.messages || []);
        loadConversations(false); // Bug #3 fix: refresh sidebar preview
        return;
      }

      // Optimistically show user message
      const tempUserMsg: Message = {
        id: "temp-" + Date.now(),
        conversationId: convId,
        sender: "CUSTOMER",
        content: textToSend,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      // Send to backend
      const updatedMessages = await conversationsApi.sendMessage(convId, textToSend);
      setMessages(updatedMessages);

      // Refresh conversation list preview (fire-and-forget — sidebar update)
      loadConversations(false).catch(console.error);
    } catch (err: any) {
      alert("Failed to send message: " + err.message);
    } finally {
      setSending(false);
      setTimeout(scrollToBottom, 50);
    }
  };

  const handleEscalateToHuman = async () => {
    if (!activeConversation) return;
    setEscalating(true);
    try {
      const lastMessage = messages[messages.length - 1]?.content || "Customer requested human escalation";
      const ticket = await ticketsApi.create({
        conversationId: activeConversation.id,
        subject: `Escalation from Chat (${activeConversation.id.slice(0, 8)})`,
        description: lastMessage,
        priority: "HIGH",
        category: "Human Escalation",
      });

      // Bug #10 fix: Removed the second conversationsApi.sendMessage() call.
      // That call triggered the full AI pipeline again, which detected "human_support_request"
      // and tried to create a SECOND ticket + added a duplicate SYSTEM message.
      // The ticket creation above already sets conversation status to WAITING_AGENT.
      // We just reload the conversation to pick up the updated status.
      await loadConversationDetails(activeConversation.id);
      setEscalationNotice(`Ticket #${ticket.id.slice(0, 8)} created. Support team notified.`);
    } catch (err: any) {
      alert("Escalation failed: " + err.message);
    } finally {
      setEscalating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Checking authentication session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
          <Bot className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Customer Chat Authentication Required</h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Please sign in to access your persistent AI support threads and ticket escalation queue.
        </p>
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all"
        >
          Sign In to Continue
        </Link>
      </div>
    );
  }

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
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">AutoSupport AI Chat</span>
              <span className="text-[10px] text-slate-400 ml-2">Phase 3 Customer Workflow</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Logged in as: <span className="font-semibold text-white">{user?.name}</span> ({user?.role})
          </span>
          <Link
            href="/agent"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Agent Inbox</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace: Sidebar + Chat Thread */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Conversations List */}
        <aside className="w-72 sm:w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800">
            <button
              onClick={handleStartNewChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Conversation</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingList ? (
              <div className="p-4 text-center text-xs text-slate-500">Loading sessions...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <Clock className="w-6 h-6 mx-auto text-slate-600" />
                <p>No conversation history yet.</p>
                <p className="text-[11px] text-slate-600">Click &quot;New Conversation&quot; or ask a question to start.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversation?.id === conv.id;
                const lastMsg = conv.messages?.[0]?.content || "New conversation";
                return (
                  <button
                    key={conv.id}
                    onClick={() => loadConversationDetails(conv.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                        : "hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs text-slate-200 truncate max-w-[170px]">
                        {conv.id.slice(0, 8)}...
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                          conv.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : conv.status === "WAITING_AGENT"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {conv.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate leading-relaxed">{lastMsg}</p>
                    <div className="text-[9px] text-slate-600 mt-1 flex items-center justify-between">
                      <span>{new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>{conv._count?.messages || 0} messages</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Chat Thread */}
        <section className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {/* Thread Status Bar */}
          {activeConversation ? (
            <div className="h-12 border-b border-slate-800/80 bg-slate-900/40 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Thread: <code className="text-slate-300">{activeConversation.id.slice(0, 8)}</code>
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    activeConversation.status === "WAITING_AGENT"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : activeConversation.status === "RESOLVED"
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  Status: {activeConversation.status}
                </span>
              </div>

              {activeConversation.status !== "WAITING_AGENT" && (
                <button
                  onClick={handleEscalateToHuman}
                  disabled={escalating}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium transition-colors"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>{escalating ? "Escalating..." : "Ask for Human Agent"}</span>
                </button>
              )}
            </div>
          ) : null}

          {/* Escalation notice banner */}
          {escalationNotice && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{escalationNotice}</span>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {!activeConversation || messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">How can we help you today?</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Ask questions about products, shipping, returns, or request human support.
                  </p>
                </div>
                <div className="w-full space-y-2 pt-2">
                  <button
                    onClick={() => handleSendMessage(undefined, "What is the return and refund policy?")}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 hover:border-indigo-500/40 transition-colors"
                  >
                    💡 What is the return and refund policy?
                  </button>
                  <button
                    onClick={() => handleSendMessage(undefined, "How long does standard delivery take?")}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 hover:border-indigo-500/40 transition-colors"
                  >
                    📦 How long does standard delivery take?
                  </button>
                  <button
                    onClick={() => handleSendMessage(undefined, "I need to speak with a human support agent")}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 hover:border-amber-500/40 transition-colors"
                  >
                    🙋 I need to speak with a human support agent
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isCustomer = msg.sender === "CUSTOMER";
                const isSystem = msg.sender === "SYSTEM";
                const isAgent = msg.sender === "AGENT";

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{msg.content}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-2xl ${
                      isCustomer ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                        isCustomer
                          ? "bg-indigo-600 text-white"
                          : isAgent
                          ? "bg-purple-600 text-white"
                          : "bg-slate-800 text-indigo-400 border border-slate-700"
                      }`}
                    >
                      {isCustomer ? <User className="w-4 h-4" /> : isAgent ? <Headphones className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Content Card */}
                    <div
                      className={`rounded-2xl p-4 text-xs leading-relaxed ${
                        isCustomer
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10"
                          : isAgent
                          ? "bg-purple-950/40 border border-purple-500/30 text-purple-100 rounded-tl-none shadow-md shadow-purple-500/10"
                          : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-md"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className="font-semibold text-[11px] opacity-80">
                          {isCustomer ? "You" : isAgent ? "Human Support Agent" : "AutoSupport AI Assistant"}
                        </span>
                        <span className="text-[10px] opacity-50">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Phase 4 AI Classification & Model Metadata */}
                      {msg.sender === "AI" && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                              {msg.metadata?.classification?.intent
                                ? msg.metadata.classification.intent.replace(/_/g, " ").toUpperCase()
                                : "GENERAL FAQ"}
                            </span>
                            {msg.metadata?.classification?.confidenceScore && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                {Math.round(msg.metadata.classification.confidenceScore * 100)}% Confidence
                              </span>
                            )}
                            {msg.metadata?.modelUsed && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {msg.metadata.modelUsed}
                              </span>
                            )}
                            {msg.metadata?.latencyMs !== undefined && (
                              <span className="text-slate-500">
                                {msg.metadata.latencyMs}ms
                              </span>
                            )}
                          </div>
                          {msg.metadata?.classification?.reasoning && (
                            <p className="text-[10px] text-slate-400 italic">
                              &ldquo;{msg.metadata.classification.reasoning}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                      {/* Phase 5 Grounded RAG Citations */}
                      {msg.sender === "AI" && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => toggleSources(msg.id)}
                            className="flex items-center justify-between w-full text-[11px] font-medium text-emerald-400 bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Verified Sources ({msg.sources.length} {msg.sources.length === 1 ? "source" : "sources"} cited)</span>
                            </div>
                            {expandedSources[msg.id] ? (
                              <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            )}
                          </button>

                          {expandedSources[msg.id] && (
                            <div className="mt-2 space-y-2">
                              {msg.sources.map((src, idx) => {
                                const docTitle = src.documentChunk?.document?.title || "Knowledge Base Document";
                                const page = src.documentChunk?.pageNumber;
                                const snippet = src.documentChunk?.content || "";
                                const score = src.relevanceScore !== undefined && src.relevanceScore !== null
                                  ? Math.round(src.relevanceScore * 100)
                                  : null;

                                return (
                                  <div
                                    key={src.id || idx}
                                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between font-semibold text-slate-200">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                                        <span className="truncate">{docTitle}</span>
                                        {page && (
                                          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                                            Page {page}
                                          </span>
                                        )}
                                      </div>
                                      {score !== null && (
                                        <span className="text-[10px] text-emerald-400 font-mono shrink-0 ml-2">
                                          {score}% match
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/80 font-mono leading-relaxed max-h-24 overflow-y-auto">
                                      &ldquo;{snippet}&rdquo;
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex gap-3 max-w-2xl mr-auto">
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span>AI assistant is processing question...</span>
                </div>
              </div>
            )}

            {/* Phase 6 Post-Resolution CSAT Rating Widget */}
            {activeConversation &&
              (activeConversation.status === "RESOLVED" ||
                activeConversation.tickets?.[0]?.status === "RESOLVED") && (
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-purple-500/30 max-w-lg mx-auto text-center space-y-3 shadow-xl my-4">
                  <div className="flex items-center justify-center gap-1.5 text-purple-400 font-semibold text-xs">
                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Support Ticket Resolved • How was your experience?</span>
                  </div>

                  {csatSubmitted ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Thank you for your rating! Your feedback helps us improve.</span>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitCsat} className="space-y-3">
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setCsatRating(star)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                              csatRating >= star
                                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 scale-105"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            ★ {star}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={csatComment}
                        onChange={(e) => setCsatComment(e.target.value)}
                        placeholder="Optional: share feedback on your support experience..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={submittingCsat}
                        className="w-full py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
                      >
                        {submittingCsat ? "Submitting..." : "Submit Experience Rating"}
                      </button>
                    </form>
                  )}
                </div>
              )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md shrink-0">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
              <input
                type="text"
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                placeholder="Type your question (e.g. 'Can I return an opened item?', 'I need an agent')..."
                disabled={sending}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !inputContent.trim()}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:hover:bg-indigo-600"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
