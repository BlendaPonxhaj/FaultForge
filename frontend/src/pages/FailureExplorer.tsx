
import { useEffect, useState } from "react";

import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Layers3
} from "lucide-react";

import {
  getInspectionCases,
  getInspectionImageUrl,
  getHeatmapUrl
} from "../services/api";

import type {
  InspectionCase,
  FaultForgeReport
} from "../services/api";

interface Props {
  report: FaultForgeReport;
}

export default function FailureExplorer({ report }: Props) {
  const [cases, setCases] = useState<InspectionCase[]>([]);
  const [selected, setSelected] = useState<InspectionCase | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [heatmapError, setHeatmapError] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    getInspectionCases()
      .then((items) => {
        setCases(items);

        setSelected(
          items.find((item) => item.status === "missed") ??
          items[0] ??
          null
        );
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : String(err)
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter((item) => {
    const matchesSearch = item.sample_id
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesFilter =
      filter === "all" || item.status === filter;

    return matchesSearch && matchesFilter;
  });

  function selectCase(item: InspectionCase) {
    setHeatmapError(false);
    setImageError(false);
    setSelected(item);
  }

  function predictionLabel(value: boolean) {
    return value
      ? "DEFECT DETECTED"
      : "NO DEFECT DETECTED";
  }

  function predictionColor(value: boolean) {
    return value ? "text-rose-400" : "text-emerald-400";
  }

  function statusColor(status: string) {
    if (status === "recovered") {
      return "bg-emerald-500/10 text-emerald-400";
    }

    if (status === "missed" || status === "regression") {
      return "bg-rose-500/10 text-rose-400";
    }

    if (status === "false_alarm") {
      return "bg-amber-500/10 text-amber-300";
    }

    return "bg-slate-700/50 text-slate-400";
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-violet-400">
          <Layers3 size={15} />
          INSPECTION INTELLIGENCE
        </div>

        <h1 className="text-3xl font-bold text-white">
          Failure Explorer
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          {report.dataset} · Compare individual model predictions
        </p>
      </div>

      {/* API Error */}
      {error && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-300">
          Failed to load inspection cases: {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-[#131c2c] p-8 text-center text-slate-400">
          Loading inspection cases...
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* LEFT SIDE: Case List */}
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#131c2c]">
            <div className="space-y-3 border-b border-slate-800 p-4">
              <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3">
                <Search
                  size={17}
                  className="shrink-0 text-slate-500"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search image or defect category..."
                  className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
              >
                <option value="all">All cases</option>
                <option value="recovered">Recovered</option>
                <option value="missed">Missed defects</option>
                <option value="false_alarm">False alarms</option>
                <option value="regression">Regressions</option>
                <option value="other">Other cases</option>
              </select>

              <p className="text-xs text-slate-500">
                {filtered.length} matching inspections
              </p>
            </div>

            <div className="max-h-[650px] space-y-1 overflow-y-auto p-2">
              {filtered.map((item) => (
                <button
                  key={item.sample_id}
                  onClick={() => selectCase(item)}
                  className={`w-full rounded-xl p-3 text-left transition ${
                    selected?.sample_id === item.sample_id
                      ? "bg-violet-600/20 ring-1 ring-violet-500/40"
                      : "hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {item.status === "recovered" ? (
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 shrink-0 text-emerald-400"
                      />
                    ) : item.status === "missed" ||
                      item.status === "regression" ? (
                      <AlertTriangle
                        size={16}
                        className="mt-0.5 shrink-0 text-rose-400"
                      />
                    ) : (
                      <ImageIcon
                        size={16}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                    )}

                    <span className="break-all text-xs leading-5 text-white">
                      {item.sample_id}
                    </span>
                  </div>

                  <div className="mt-2 pl-6">
                    <span className={`inline-block rounded-md px-2 py-1 text-xs capitalize ${statusColor(item.status)}`}>
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">
                  No matching inspections found.
                </p>
              )}
            </div>
          </section>

          {/* RIGHT SIDE: Selected Case */}
          <section className="min-w-0 rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
            {selected ? (
              <div className="space-y-6">
                {/* Case Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="break-all text-lg font-semibold text-white">
                      {selected.sample_id}
                    </h2>

                    <p className="mt-2 text-sm capitalize text-slate-400">
                      Category: {selected.category}
                    </p>
                  </div>

                  <span className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize ${statusColor(selected.status)}`}>
                    {selected.status.replaceAll("_", " ")}
                  </span>
                </div>

                {/* Images */}
                <div className="grid gap-4 xl:grid-cols-2">
                  {/* Original Image */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                      Original Inspection Image
                    </h3>

                    <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl bg-white p-4">
                      {imageError ? (
                        <p className="text-sm text-slate-600">
                          Original image could not be loaded.
                        </p>
                      ) : (
                        <img
                          key={selected.sample_id}
                          src={getInspectionImageUrl(selected.sample_id)}
                          alt={`Inspection sample ${selected.sample_id}`}
                          className="max-h-[360px] max-w-full object-contain"
                          onError={() => setImageError(true)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Heatmap */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                      Patch-Based Anomaly Heatmap
                    </h3>

                    <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl bg-slate-900 p-4">
                      {heatmapError ? (
                        <div className="text-center">
                          <AlertTriangle
                            size={24}
                            className="mx-auto text-amber-400"
                          />
                          <p className="mt-3 text-sm text-slate-400">
                            Heatmap not generated for this image yet.
                          </p>
                        </div>
                      ) : (
                        <img
                          key={selected.sample_id}
                          src={getHeatmapUrl(selected.sample_id)}
                          alt={`Anomaly heatmap for ${selected.sample_id}`}
                          className="max-h-[360px] max-w-full object-contain"
                          onError={() => setHeatmapError(true)}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs leading-5 text-slate-500">
                  Red areas in the heatmap indicate higher anomaly
                  scores relative to other regions of the same image.
                  This is not a validated defect segmentation mask.
                  Heatmaps are currently available only for selected
                  recovered and missed defect cases.
                </p>

                {/* Predictions */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
                    <p className="text-xs font-semibold tracking-wide text-slate-400">
                      GLOBAL RESNET18
                    </p>

                    <p className={`mt-4 text-sm font-semibold ${predictionColor(selected.baseline.predicted_defect)}`}>
                      {predictionLabel(selected.baseline.predicted_defect)}
                    </p>

                    <p className="mt-3 text-xs text-slate-400">
                      Anomaly score
                    </p>

                    <p className="mt-1 text-xl font-bold text-white">
                      {selected.baseline.anomaly_score.toFixed(4)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
                    <p className="text-xs font-semibold tracking-wide text-slate-400">
                      PATCH-BASED INSPECTOR
                    </p>

                    <p className={`mt-4 text-sm font-semibold ${predictionColor(selected.candidate.predicted_defect)}`}>
                      {predictionLabel(selected.candidate.predicted_defect)}
                    </p>

                    <p className="mt-3 text-xs text-slate-400">
                      Anomaly score
                    </p>

                    <p className="mt-1 text-xl font-bold text-white">
                      {selected.candidate.anomaly_score.toFixed(4)}
                    </p>
                  </div>
                </div>

                {/* Ground Truth */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <span className="text-sm text-slate-400">
                    Ground Truth
                  </span>

                  <span className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    selected.actual_defect
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {selected.actual_defect ? "DEFECTIVE" : "NORMAL"}
                  </span>
                </div>

                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs leading-6 text-slate-400">
                  The two models use different scoring scales.
                  Their raw anomaly scores should not be compared
                  directly. All current evaluation results are
                  exploratory and have not undergone independent
                  validation.
                </div>
              </div>
            ) : (
              <div className="flex min-h-[350px] items-center justify-center text-slate-400">
                No inspection case selected.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
