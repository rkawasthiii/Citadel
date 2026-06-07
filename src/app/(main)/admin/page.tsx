"use client";

import { useState, useEffect } from "react";

interface Niche {
  name: string;
  slug: string;
  totalPapers: number;
  totalFollowers: number;
}

export default function AdminPage() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchNiches();
  }, []);

  const fetchNiches = async () => {
    try {
      const res = await fetch("/api/trigger-feed");
      const data = await res.json();
      if (data.success) {
        setNiches(data.niches);
      }
    } catch (error) {
      console.error("Failed to fetch niches:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerFeed = async (field?: string) => {
    try {
      setTriggering(field || "all");
      setMessage(null);

      const url = field
        ? `/api/trigger-feed?field=${encodeURIComponent(field)}`
        : `/api/trigger-feed`;

      const res = await fetch(url, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: `✅ ${data.message}. Check Inngest dashboard to monitor progress.`,
        });
        // Refresh niches after a delay
        setTimeout(fetchNiches, 2000);
      } else {
        setMessage({
          type: "error",
          text: `❌ ${data.error || "Failed to trigger feed"}`,
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: `❌ Failed to trigger feed: ${error}`,
      });
    } finally {
      setTriggering(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading niches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Feed Management Dashboard
          </h1>
          <p className="text-gray-600">
            Manage and populate research paper feeds for all niches
          </p>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => triggerFeed()}
              disabled={triggering !== null}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {triggering === "all" ? "Populating All..." : "🚀 Populate All Niches"}
            </button>
            <a
              href="http://localhost:8288"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
            >
              📊 Open Inngest Dashboard
            </a>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Total Niches</div>
            <div className="text-3xl font-bold text-gray-900">
              {niches.length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Total Papers</div>
            <div className="text-3xl font-bold text-blue-600">
              {niches.reduce((sum, n) => sum + n.totalPapers, 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Total Followers</div>
            <div className="text-3xl font-bold text-purple-600">
              {niches.reduce((sum, n) => sum + n.totalFollowers, 0)}
            </div>
          </div>
        </div>

        {/* Niches Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            All Niches ({niches.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {niches.map((niche) => (
              <div
                key={niche.slug}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{niche.name}</h3>
                  <button
                    onClick={() => triggerFeed(niche.name)}
                    disabled={triggering !== null}
                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {triggering === niche.name ? "..." : "Populate"}
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  <div>📄 {niche.totalPapers} papers</div>
                  <div>👥 {niche.totalFollowers} followers</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            📚 How Feed Population Works
          </h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>
              • <strong>Populate All:</strong> Triggers feed population for all
              23 niches (takes ~10-15 min)
            </li>
            <li>
              • <strong>Individual Populate:</strong> Triggers feed for a single
              niche (~30-60 sec)
            </li>
            <li>
              • <strong>Automated Schedule:</strong> Feeds auto-populate daily at
              3 AM UTC
            </li>
            <li>
              • <strong>Duplicate Prevention:</strong> System automatically skips
              papers already in database
            </li>
            <li>
              • <strong>Monitor Progress:</strong> Open Inngest dashboard to see
              real-time execution
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
