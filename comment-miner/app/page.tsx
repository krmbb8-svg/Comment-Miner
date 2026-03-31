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
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreBorderColor(score: number) {
  if (score >= 70) return "border-green-500";
  if (score >= 40) return "border-amber-500";
  return "border-red-500";
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
  const sentimentColors = ["#22c55e", "#9ca3af", "#ef4444"];

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Comment Miner</h1>
          <p className="text-gray-500 text-sm mt-1">
            Analyze YouTube comments to surface content ideas
          </p>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleAnalyze} className="flex gap-3 mb-8">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-lg bg-gray-900 border border-gray-800 px-4 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
          {result && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportJSON}
                className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                {copied ? "Copied!" : "Copy JSON"}
              </button>
              <button
                type="button"
                onClick={exportText}
                className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Download
              </button>
            </div>
          )}
        </form>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500 mb-4" />
            <p className="text-gray-500 text-sm">
              Fetching comments and analyzing with AI...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 p-4 text-red-400 text-sm text-center mb-8">
            {error}
          </div>
        )}

        {/* Dashboard */}
        {result && (
          <div className="space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Comments Analyzed"
                value={result.commentCount.toString()}
                accent="border-blue-500"
              />
              <StatCard
                label="Sentiment Score"
                value={`${result.sentimentScore}/100`}
                accent={scoreBorderColor(result.sentimentScore)}
                valueClass={scoreColor(result.sentimentScore)}
              />
              <StatCard
                label="Top Theme"
                value={
                  result.themeCounts[0]?.theme ?? result.recurringThemes[0] ?? "—"
                }
                accent="border-purple-500"
                small
              />
              <StatCard
                label="Questions Found"
                value={result.engagementSignals.questionsCount.toString()}
                accent="border-amber-500"
              />
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Sentiment Breakdown */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">
                  Sentiment Breakdown
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sentimentChartData}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [`${value}%`, "Share"]}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {sentimentChartData.map((_, i) => (
                        <Cell key={i} fill={sentimentColors[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Theme Distribution */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">
                  Theme Distribution
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={result.themeCounts.slice(0, 6)}
                    layout="vertical"
                    margin={{ left: 10 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="theme"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [value, "Comments"]}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insight Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              <InsightCard
                title="Content Ideas"
                count={result.contentIdeas.length}
                accent="border-t-blue-500"
                dotColor="text-blue-400"
                items={result.contentIdeas}
              />
              <InsightCard
                title="Top Questions"
                count={result.topQuestions.length}
                accent="border-t-purple-500"
                dotColor="text-purple-400"
                items={result.topQuestions}
              />
              <InsightCard
                title="Recurring Themes"
                count={result.recurringThemes.length}
                accent="border-t-green-500"
                dotColor="text-green-400"
                items={result.recurringThemes}
              />
              <div className="rounded-xl bg-gray-900 border border-gray-800 border-t-2 border-t-amber-500 p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  Sentiment Overview
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {result.sentiment}
                </p>
                <div className="mt-4 flex gap-4 text-xs text-gray-500">
                  <span>
                    Suggestions: {result.engagementSignals.suggestionsCount}
                  </span>
                  <span>
                    Complaints: {result.engagementSignals.complaintsCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400">
                Analysis History
              </h2>
              <button
                onClick={clearHistory}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 truncate">{entry.url}</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {new Date(entry.timestamp).toLocaleDateString()} ·{" "}
                      {entry.result.commentCount} comments · Score:{" "}
                      <span className={scoreColor(entry.result.sentimentScore)}>
                        {entry.result.sentimentScore}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => loadFromHistory(entry)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteFromHistory(entry.id)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
  valueClass,
  small,
}: {
  label: string;
  value: string;
  accent: string;
  valueClass?: string;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-xl bg-gray-900 border border-gray-800 border-l-2 ${accent} p-4`}
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`${small ? "text-sm" : "text-2xl"} font-bold ${valueClass ?? "text-gray-100"} truncate`}
      >
        {value}
      </p>
    </div>
  );
}

function InsightCard({
  title,
  count,
  accent,
  dotColor,
  items,
}: {
  title: string;
  count: number;
  accent: string;
  dotColor: string;
  items: string[];
}) {
  return (
    <div
      className={`rounded-xl bg-gray-900 border border-gray-800 border-t-2 ${accent} p-5`}
    >
      <h3 className="text-sm font-semibold text-gray-400 mb-3">
        {title}{" "}
        <span className="text-gray-600 font-normal">({count})</span>
      </h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className={`${dotColor} shrink-0`}>•</span>
            <span className="text-gray-300">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
