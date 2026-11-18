"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Database,
  Upload,
  FileText,
  Search,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Sparkles,
  ArrowLeft,
  X,
  FileCheck,
  ShieldAlert,
  Sliders,
  Clock,
  BookOpen,
  BarChart3,
  FlaskConical,
} from "lucide-react";
import { useAuth } from "../../context/auth-context";
import {
  KnowledgeDocument,
  DocumentChunk,
  SearchResultChunk,
  knowledgeApi,
} from "../../lib/api";

export default function AdminKnowledgePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Document inventory
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunk inspector modal state
  const [inspectingDoc, setInspectingDoc] = useState<KnowledgeDocument | null>(null);
  const [docChunks, setDocChunks] = useState<DocumentChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState<boolean>(false);

  // Semantic search sandbox state
  const [searchQuery, setSearchQuery] = useState<string>("What is the return window for items?");
  const [searchLimit, setSearchLimit] = useState<number>(3);
  const [searchThreshold, setSearchThreshold] = useState<number>(0.5);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResultChunk[] | null>(null);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const data = await knowledgeApi.getAll();
      setDocuments(data);
    } catch (err: any) {
      console.error("Failed to load documents", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!docTitle) {
        // Auto-generate a readable title from filename
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setDocTitle(cleanName);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !docTitle.trim() || isUploading) return;

    setIsUploading(true);
    setUploadFeedback(null);

    try {
      const newDoc = await knowledgeApi.upload(selectedFile, docTitle.trim());
      setUploadFeedback({
        type: "success",
        message: `Successfully ingested "${newDoc.title}". Extracted and indexed ${
          newDoc._count?.chunks || 0
        } vector chunks into pgvector!`,
      });
      setSelectedFile(null);
      setDocTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchDocuments();
    } catch (err: any) {
      setUploadFeedback({
        type: "error",
        message: `Ingestion failed: ${err.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSamplePolicy = async () => {
    setIsUploading(true);
    setUploadFeedback(null);
    try {
      const sampleText = `Enterprise Return, Refund, and Customer Warranty Policy 2026

Section 1: General Return Eligibility
Customers can return most items within 30 days of the confirmed delivery date for a full refund to the original payment method. Items must be in their original packaging, unwashed, and include all accessories, manuals, and tags. 

Section 2: Electronics and Peripherals
Electronics, smart devices, computers, and battery-operated equipment carry a strict 14-day return window from the delivery date. Items with opened manufacturer packaging must pass a diagnostic inspection before refunds are credited. A restocking fee of 10% applies to returned opened laptops and tablets.

Section 3: Non-Returnable Merchandise
The following products are strictly non-returnable: custom-engraved or personalized merchandise, opened in-ear headphones due to sanitary regulations, downloadable software licenses, and perishable grocery goods.

Section 4: Warranty and Defect Protection
All hardware purchases include an automatic 1-year limited warranty against hardware failure and manufacturer defects. For technical defects within 90 days, we provide instant cross-shipping replacements at zero shipping charge.

Section 5: Customer Escalation & Disputes
If you have an issue with an unauthorized charge or damaged shipment, you may request immediate escalation to a human support agent. Human support representatives are available Monday through Saturday from 8:00 AM to 8:00 PM EST.`;

      const blob = new Blob([sampleText], { type: "text/plain" });
      const file = new File([blob], "Enterprise_Customer_Policy_2026.txt", {
        type: "text/plain",
      });

      const newDoc = await knowledgeApi.upload(
        file,
        "Enterprise Return & Warranty Policy 2026",
      );
      setUploadFeedback({
        type: "success",
        message: `Sample policy ingested! Created ${
          newDoc._count?.chunks || 0
        } vector chunks with 1536-dimensional embeddings.`,
      });
      await fetchDocuments();
    } catch (err: any) {
      setUploadFeedback({
        type: "error",
        message: `Failed to load sample policy: ${err.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${title}"? This will cascade-delete all indexed chunks from the pgvector database.`,
      )
    ) {
      return;
    }

    try {
      await knowledgeApi.delete(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (inspectingDoc?.id === id) {
        setInspectingDoc(null);
      }
    } catch (err: any) {
      alert("Failed to delete document: " + err.message);
    }
  };

  const handleInspectChunks = async (doc: KnowledgeDocument) => {
    setInspectingDoc(doc);
    setLoadingChunks(true);
    try {
      const fullDoc = await knowledgeApi.getById(doc.id);
      setDocChunks(fullDoc.chunks || []);
    } catch (err: any) {
      alert("Failed to load document chunks: " + err.message);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleRunSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    try {
      const results = await knowledgeApi.search(
        searchQuery.trim(),
        searchLimit,
        searchThreshold,
      );
      setSearchResults(results);
    } catch (err: any) {
      alert("Semantic search failed: " + err.message);
    } finally {
      setSearching(false);
    }
  };

  const totalChunks = documents.reduce(
    (acc, doc) => acc + (doc._count?.chunks || 0),
    0,
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Checking session credentials...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
          <Database className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          Administrator Authentication Required
        </h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Sign in with an ADMIN account to manage knowledge documents, inspect vector embeddings, and test RAG retrieval.
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

  // Bug #13 fix: Frontend RBAC guard — only ADMIN can manage knowledge base
  if (user?.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Knowledge Base administration is strictly restricted to Administrators. Your role is{" "}
          <span className="text-rose-300 font-semibold">{user?.role || "UNKNOWN"}</span>.
        </p>
        <Link
          href={user?.role === "AGENT" ? "/agent" : "/chat"}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all"
        >
          {user?.role === "AGENT" ? "Go to Agent Inbox" : "Go to Customer Chat"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
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
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">
                Knowledge Base & Vector Store
              </span>
              <span className="text-[10px] text-emerald-400 font-mono ml-2">
                Phase 5 RAG Engine
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Admin: <span className="font-semibold text-white">{user?.name}</span> ({user?.role})
          </span>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Customer Chat</span>
          </Link>
          <Link
            href="/agent"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
          >
            <span>Agent Inbox</span>
          </Link>
          <Link
            href="/admin/analytics"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics Dashboard</span>
          </Link>
          <Link
            href="/admin/eval"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>AI Benchmark</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Architecture Metrics Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Documents</p>
              <p className="text-xl font-bold text-white font-mono">{documents.length}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Vector Chunks</p>
              <p className="text-xl font-bold text-white font-mono">{totalChunks}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Embedding Dimension</p>
              <p className="text-xl font-bold text-white font-mono">1,536-D</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Distance Metric</p>
              <p className="text-sm font-bold text-amber-300 font-mono">Cosine (&lt;=&gt;)</p>
            </div>
          </div>
        </div>

        {/* Ingestion & Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-sm text-white">Ingest New Document</h2>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                PDF / TXT / MD
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Upload company policies, product guides, or FAQ documents. The pipeline splits text into 800-character semantic chunks with 150-char overlap and embeds them with pgvector.
            </p>

            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Return Policy 2026"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  File (.pdf, .txt, .md, .json)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.txt,.md,.json,.csv"
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-emerald-600/20 file:text-emerald-300 hover:file:bg-emerald-600/30 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={!selectedFile || !docTitle.trim() || isUploading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-40"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Chunking & Vectorizing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Index into pgvector</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLoadSamplePolicy}
                  disabled={isUploading}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700/60 transition-colors"
                >
                  ⚡ Load Sample Enterprise Policy (1-Click)
                </button>
              </div>
            </form>

            {uploadFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  uploadFeedback.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    : "bg-red-500/10 border border-red-500/20 text-red-300"
                }`}
              >
                {uploadFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                )}
                <span>{uploadFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Document Inventory Table */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-sm text-white">Indexed Knowledge Documents</h2>
              </div>
              <button
                onClick={fetchDocuments}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Refresh Document List"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-x-auto">
              {loadingDocs ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
                  Loading vector repository...
                </div>
              ) : documents.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <Database className="w-8 h-8 mx-auto text-slate-600" />
                  <p>No knowledge base documents indexed yet.</p>
                  <p className="text-[11px] text-slate-600">
                    Use the upload form or click &quot;Load Sample Enterprise Policy&quot; to begin.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-medium">
                      <th className="pb-2.5">Title & Filename</th>
                      <th className="pb-2.5">Format</th>
                      <th className="pb-2.5">Chunks</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3">
                          <p className="font-semibold text-white">{doc.title}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-xs font-mono">
                            {doc.originalFilename}
                          </p>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                            {(doc.originalFilename.split(".").pop() || "DOC").toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="font-mono text-emerald-400 font-semibold">
                            {doc._count?.chunks || 0}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              doc.processingStatus === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : doc.processingStatus === "PROCESSING" || doc.processingStatus === "PENDING"
                                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                : "bg-red-500/10 text-red-300 border border-red-500/20"
                            }`}
                          >
                            {doc.processingStatus}
                          </span>
                        </td>
                        <td className="py-3 text-right space-x-1.5">
                          <button
                            onClick={() => handleInspectChunks(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Chunks</span>
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id, doc.title)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RAG Semantic Search & Cosine Distance Testing Sandbox */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">
                Live pgvector Semantic Search & Distance Sandbox
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Vector Query: &lt;=&gt; Cosine Distance Retrieval
            </p>
          </div>

          <p className="text-xs text-slate-400">
            Simulate the RAG retrieval pipeline in real-time. Enter an arbitrary customer query to see which document chunks are fetched, their similarity percentage, and cosine distance from the vector space.
          </p>

          <form onSubmit={handleRunSearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask any question (e.g. 'Can I return an opened laptop?')..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-40"
              >
                {searching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Run Semantic Query</span>
                  </>
                )}
              </button>
            </div>

            {/* Hyperparameter adjustments */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-2">
                <span>Top-K Chunks:</span>
                <select
                  value={searchLimit}
                  onChange={(e) => setSearchLimit(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
                >
                  <option value={1}>Top 1</option>
                  <option value={3}>Top 3</option>
                  <option value={5}>Top 5</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span>Similarity Threshold:</span>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={searchThreshold}
                  onChange={(e) => setSearchThreshold(parseFloat(e.target.value))}
                  className="w-24 accent-emerald-500 cursor-pointer"
                />
                <span className="font-mono text-emerald-400">
                  {Math.round(searchThreshold * 100)}%
                </span>
              </div>
            </div>
          </form>

          {/* Search Result Cards */}
          {searchResults && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Retrieved <strong className="text-white">{searchResults.length}</strong> matching chunks
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Order by cosine similarity ASC
                </span>
              </div>

              {searchResults.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                  No chunks passed the similarity threshold of {Math.round(searchThreshold * 100)}%. Try lowering the threshold or asking a related question.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchResults.map((chunk, index) => (
                    <div
                      key={chunk.id || index}
                      className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-2 text-xs flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono text-[10px] font-bold">
                            #{index + 1} MATCH
                          </span>
                          <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                            {Math.round((chunk.similarityScore || 0) * 100)}% Match
                          </span>
                        </div>
                        <p className="font-semibold text-white truncate">
                          {chunk.documentTitle}
                        </p>
                        {chunk.pageNumber && (
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            Page {chunk.pageNumber}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 font-mono leading-relaxed line-clamp-5 hover:line-clamp-none transition-all">
                        &ldquo;{chunk.content}&rdquo;
                      </p>

                      <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Chunk #{chunk.chunkIndex}</span>
                        <span>Score: {(chunk.similarityScore || 0).toFixed(4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Chunk Inspector Modal */}
      {inspectingDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">
                  Vector Chunks: {inspectingDoc.title}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {inspectingDoc.originalFilename} • {docChunks.length} chunks indexed
                </p>
              </div>
              <button
                onClick={() => setInspectingDoc(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingChunks ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
                  Loading chunks...
                </div>
              ) : docChunks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No chunks found for this document.
                </div>
              ) : (
                docChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="font-bold text-emerald-400">
                        Chunk #{chunk.chunkIndex}
                      </span>
                      {chunk.pageNumber && (
                        <span>Page {chunk.pageNumber}</span>
                      )}
                      <span>{chunk.content.length} characters</span>
                    </div>
                    <p className="text-slate-300 whitespace-pre-wrap font-mono text-[11px] bg-slate-900/50 p-3 rounded-lg border border-slate-800/60 leading-relaxed">
                      {chunk.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
