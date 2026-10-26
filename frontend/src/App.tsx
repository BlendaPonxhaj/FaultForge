
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  ScanSearch,
  Bot,
  FileText,
  FlaskConical,
  RefreshCw,
  Wifi,
  WifiOff,
  Menu,
  X
} from "lucide-react";

import Dashboard from "./pages/Dashboard";
import FailureExplorer from "./pages/FailureExplorer";
import AgentLab from "./pages/AgentLab";
import Reports from "./pages/Reports";

import { getReport } from "./services/api";
import type { FaultForgeReport } from "./services/api";

type Page = "Dashboard" | "Failure Explorer" | "Agent Lab" | "Reports";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Failure Explorer", icon: ScanSearch },
  { label: "Agent Lab", icon: Bot },
  { label: "Reports", icon: FileText }
] as const;

export default function App() {
  const [activePage, setActivePage] = useState<Page>("Dashboard");
  const [report, setReport] = useState<FaultForgeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadReport(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getReport();
      setReport(data);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown API error"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  function navigate(page: Page) {
    setActivePage(page);
    setSidebarOpen(false);
  }

  function renderPage() {
    if (!report) return null;

    switch (activePage) {
      case "Dashboard":
        return <Dashboard report={report} />;

      case "Failure Explorer":
        return <FailureExplorer report={report} />;

      case "Agent Lab":
        return <AgentLab report={report} />;

      case "Reports":
        return <Reports report={report} />;
    }
  }

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-800 bg-[#101827] p-5 transition-transform lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-600 p-2.5 text-white">
              <FlaskConical size={22} />
            </div>

            <div className="text-xl font-extrabold tracking-tight text-white">
              Fault<span className="text-violet-400">Forge</span>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          AI Reliability & Verification Platform
        </p>

        <div className="mt-12 text-xs font-semibold tracking-widest text-slate-500">
          WORKSPACE
        </div>

        <nav className="mt-4 space-y-2">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(label)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                activePage === label
                  ? "bg-violet-600/20 font-medium text-violet-300"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-7 left-5 right-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm font-medium text-white">
            Experimental Build
          </p>
          <p className="mt-2 text-xs text-slate-500">
            FaultForge v0.1 · Development
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-[#0b1220]/95 px-5 py-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-300 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={23} />
            </button>

            <div>
              <p className="text-sm font-semibold text-white">
                FaultForge Workspace
              </p>
              <p className="text-xs text-slate-500">
                Industrial AI Reliability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              report && !error
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-rose-500/20 bg-rose-500/10 text-rose-400"
            }`}>
              {report && !error ? (
                <Wifi size={13} />
              ) : (
                <WifiOff size={13} />
              )}

              {report && !error ? "API Connected" : "API Offline"}
            </span>

            <button
              onClick={() => void loadReport(true)}
              disabled={refreshing}
              className="rounded-xl border border-slate-700 p-2.5 text-slate-300 transition hover:bg-slate-800"
              title="Refresh report"
              aria-label="Refresh report"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-5 lg:p-9">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="text-center">
                <RefreshCw
                  size={30}
                  className="mx-auto animate-spin text-violet-400"
                />
                <p className="mt-4 text-slate-400">
                  Loading FaultForge report...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6">
              <h2 className="font-semibold text-rose-400">
                Cannot connect to backend
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {error}
              </p>
              <p className="mt-3 text-sm text-slate-400">
                Make sure FastAPI is running on http://127.0.0.1:8000
              </p>
              <button
                onClick={() => void loadReport(true)}
                className="mt-5 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white"
              >
                Retry connection
              </button>
            </div>
          ) : (
            renderPage()
          )}
        </main>
      </div>
    </div>
  );
}
