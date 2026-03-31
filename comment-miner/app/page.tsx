"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface AnalysisResult {
  contentIdeas: string[];
  topQuestions: string[];
  recurringThemes: string[];
  sentiment: string;
  sentimentScore: number;
  commentCount: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  themeCounts: { theme: string; count: number }[];
  engagementSignals: {
    questionsCount: number;
    suggestionsCount: number;
    complaintsCount: number;
  };
}

interface HistoryEntry {
  id: string;
  url: string;
  timestamp: string;
  result: AnalysisResult;
}

const HISTORY_KEY = "comment-miner-history";
const MAX_HISTORY = 20;

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreBorderColor(score: number) {
  if (score >= 70) return "border-emerald-500";
  if (score >= 40) return "border-amber-500";
  return "border-red-500";
}

// Pickaxe icon
function PickaxeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 21 9-9" />
      <path d="m12.5 5.5 5 5" />
      <path d="m15 3 6 6-3.5 3.5-6-6z" />
      <path d="m3 9 4.5 4.5L11 10 6.5 5.5z" />
    </svg>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {
      // ignore corrupted data
    }
  }, []);

  function saveToHistory(videoUrl: string, analysisResult: AnalysisResult) {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      url: videoUrl,
      timestamp: new Date().toISOString(),
      result: analysisResult,
    };
    const updated = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }

  function loadFromHistory(entry: HistoryEntry) {
    setUrl(entry.url);
    setResult(entry.result);
    setError(null);
  }

  function deleteFromHistory(id: string) {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  function exportJSON() {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportText() {
    if (!result) return;
    const lines = [
      "COMMENT MINER REPORT",
      `URL: ${url}`,
      `Date: ${new Date().toLocaleString()}`,
      `Comments Analyzed: ${result.commentCount}`,
      `Sentiment Score: ${result.sentimentScore}/100`,
      "",
      "--- SENTIMENT ---",
      result.sentiment,
      "",
      "--- CONTENT IDEAS ---",
      ...result.contentIdeas.map((idea, i) => `${i + 1}. ${idea}`),
      "",
      "--- TOP QUESTIONS ---",
      ...result.topQuestions.map((q, i) => `${i + 1}. ${q}`),
      "",
      "--- RECURRING THEMES ---",
      ...result.recurringThemes.map((t, i) => `${i + 1}. ${t}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comment-miner-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setResult(data);
      saveToHistory(url, data);
    } catch {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const sentimentChartData = result
    ? [
        { name: "Positive", value: result.sentimentBreakdown.positive },
        { name: "Neutral", value: result.sentimentBreakdown.neutral },
        { name: "Negative", value: result.sentimentBreakdown.negative },
      ]
    : [];
  const sentimentColors = ["#34d399", "#6b7280", "#f87171"];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-600">
            <PickaxeIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Comment Miner</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4">
        <div className="w-full max-w-5xl">

          {/* Hero */}
          <div className="pt-16 pb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
              Know exactly what to create next.
            </h1>
            <p className="text-[#71717a] text-base max-w-md mx-auto">
              Paste a YouTube video URL and get a full breakdown of what your audience is asking for.
            </p>
          </div>

          {/* Input */}
          <form onSubmit={handleAnalyze} className="flex gap-2 mb-4 max-w-2xl mx-auto">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste any YouTube video URL..."
              className="flex-1 h-11 rounded-lg bg-[#111111] border border-[#2a2a2a] px-4 text-[15px] text-white placeholder-[#3f3f46] focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="h-11 px-5 rounded-lg bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? "Mining..." : "Analyze"}
            </button>
            {result && (
              <>
                <button
                  type="button"
                  onClick={exportJSON}
                  className="h-11 px-4 rounded-lg bg-[#111111] border border-[#2a2a2a] text-sm text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors whitespace-nowrap"
                >
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
                <button
                  type="button"
                  onClick={exportText}
                  className="h-11 px-4 rounded-lg bg-[#111111] border border-[#2a2a2a] text-sm text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors whitespace-nowrap"
                >
                  Export
                </button>
              </>
            )}
          </form>

          {/* Error */}
          {error && (
            <div className="max-w-2xl mx-auto mb-8 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="max-w-2xl mx-auto mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-sm text-[#71717a]">Mining comments...</span>
              </div>
              <div className="space-y-3">
                <div className="h-24 rounded-xl bg-[#111111] border border-[#1a1a1a] skeleton-pulse" />
                <div className="grid grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-[#111111] border border-[#1a1a1a] skeleton-pulse" />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-36 rounded-xl bg-[#111111] border border-[#1a1a1a] skeleton-pulse" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !result && !error && (
            <div className="max-w-2xl mx-auto pt-6 pb-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    icon: "💡",
                    title: "Content ideas",
                    desc: "Discover what your audience wants to see next, straight from the comments.",
                  },
                  {
                    icon: "❓",
                    title: "Unanswered questions",
                    desc: "Surface the most common questions viewers have about your topic.",
                  },
                  {
                    icon: "📊",
                    title: "Audience sentiment",
                    desc: "Understand how people feel and what themes keep coming up.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-[#1a1a1a] bg-[#111111] p-5"
                  >
                    <div className="text-2xl mb-3">{item.icon}</div>
                    <p className="text-sm font-medium text-white mb-1">{item.title}</p>
                    <p className="text-xs text-[#71717a] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4 mb-12">
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Comments analyzed" value={result.commentCount.toString()} accentClass="border-l-violet-500" />
                <StatCard
                  label="Sentiment score"
                  value={`${result.sentimentScore}/100`}
                  accentClass={`border-l-${result.sentimentScore >= 70 ? "emerald" : result.sentimentScore >= 40 ? "amber" : "red"}-500`}
                  valueClass={scoreColor(result.sentimentScore)}
                />
                <StatCard
                  label="Top theme"
                  value={result.themeCounts[0]?.theme ?? result.recurringThemes[0] ?? "—"}
                  accentClass="border-l-sky-500"
                  small
                />
                <StatCard label="Questions found" value={result.engagementSignals.questionsCount.toString()} accentClass="border-l-amber-500" />
              </div>

              {/* Charts */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#111111] border border-[#1a1a1a] p-5">
                  <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider mb-4">Sentiment breakdown</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sentimentChartData} barSize={40}>
                      <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value) => [`${value}%`, "Share"]}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {sentimentChartData.map((_, i) => (
                          <Cell key={i} fill={sentimentColors[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-xl bg-[#111111] border border-[#1a1a1a] p-5">
                  <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider mb-4">Theme distribution</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={result.themeCounts.slice(0, 6)} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="theme" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value) => [value, "Comments"]}
                      />
                      <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Insight cards */}
              <div className="grid gap-4 md:grid-cols-2">
                <InsightCard
                  title="Content Ideas"
                  count={result.contentIdeas.length}
                  borderColor="border-l-violet-500"
                  dotColor="bg-violet-500"
                  items={result.contentIdeas}
                />
                <InsightCard
                  title="Top Questions"
                  count={result.topQuestions.length}
                  borderColor="border-l-sky-500"
                  dotColor="bg-sky-500"
                  items={result.topQuestions}
                />
                <InsightCard
                  title="Recurring Themes"
                  count={result.recurringThemes.length}
                  borderColor="border-l-emerald-500"
                  dotColor="bg-emerald-500"
                  items={result.recurringThemes}
                />
                <div className="rounded-xl bg-[#111111] border border-[#1a1a1a] border-l-4 border-l-amber-500 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider">Sentiment overview</p>
                  </div>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">{result.sentiment}</p>
                  <div className="mt-4 pt-4 border-t border-[#1a1a1a] flex gap-5 text-xs text-[#52525b]">
                    <span>{result.engagementSignals.suggestionsCount} suggestions</span>
                    <span>{result.engagementSignals.complaintsCount} complaints</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-[#52525b] uppercase tracking-wider">Recent analyses</p>
                <button onClick={clearHistory} className="text-xs text-[#3f3f46] hover:text-[#71717a] transition-colors">
                  Clear all
                </button>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-4 rounded-lg bg-[#111111] border border-[#1a1a1a] px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#a1a1aa] truncate">{entry.url}</p>
                      <p className="text-xs text-[#52525b] mt-0.5">
                        {new Date(entry.timestamp).toLocaleDateString()} · {entry.result.commentCount} comments ·{" "}
                        <span className={scoreColor(entry.result.sentimentScore)}>{entry.result.sentimentScore}</span>
                      </p>
                    </div>
                    <button onClick={() => loadFromHistory(entry)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors shrink-0">
                      Load
                    </button>
                    <button onClick={() => deleteFromHistory(entry.id)} className="text-xs text-[#3f3f46] hover:text-red-400 transition-colors shrink-0">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-violet-600">
              <PickaxeIcon className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs text-[#52525b] font-medium">Comment Miner</span>
          </div>
          <p className="text-xs text-[#3f3f46]">Built for creators</p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  accentClass,
  valueClass,
  small,
}: {
  label: string;
  value: string;
  accentClass: string;
  valueClass?: string;
  small?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-[#111111] border border-[#1a1a1a] border-l-4 ${accentClass} px-4 py-3`}>
      <p className="text-xs text-[#52525b] mb-1">{label}</p>
      <p className={`${small ? "text-sm" : "text-xl"} font-bold ${valueClass ?? "text-white"} truncate`}>
        {value}
      </p>
    </div>
  );
}

function InsightCard({
  title,
  count,
  borderColor,
  dotColor,
  items,
}: {
  title: string;
  count: number;
  borderColor: string;
  dotColor: string;
  items: string[];
}) {
  return (
    <div className={`rounded-xl bg-[#111111] border border-[#1a1a1a] border-l-4 ${borderColor} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider">{title}</p>
        <span className="text-xs text-[#3f3f46] tabular-nums">{count}</span>
      </div>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
            <span className="text-[#a1a1aa] leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
