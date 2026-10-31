
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Layers3,
} from "lucide-react";

import {
  getDinov2Cases,
  getInspectionImageUrl,
  getDinov2HeatmapUrl,
  toPercent,
} from "../services/api";

import type {
  Dinov2Case,
  Dinov2CasesResponse,
  FaultForgeReport,
} from "../services/api";

interface Props {
  report: FaultForgeReport;
}

export default function FailureExplorer({ report }: Props) {
  const [data, setData] = useState<Dinov2CasesResponse | null>(null);
  const [selected, setSelected] = useState<Dinov2Case | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [imageError, setImageError] = useState(false);
  const [heatmapError, setHeatmapError] = useState(false);

  useEffect(() => {
    let active = true;

    getDinov2Cases()
      .then((response) => {
        if (!active) return;

        setData(response);

        setSelected(
          response.cases.find(
            (item) => item.status === "missed"
          ) ??
          response.cases[0] ??
          null
        );
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : String(err)
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return (data?.cases ?? []).filter((item) => {
      const matchesSearch = item.sample_id
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [data, search, filter]);

  function selectCase(item: Dinov2Case) {
    setSelected(item);
    setImageError(false);
    setHeatmapError(false);
  }

  function statusColor(status: string): string {
    if (status === "missed") {
      return "bg-rose-500/10 text-rose-400";
    }

    if (status === "false_alarm") {
      return "bg-amber-500/10 text-amber-300";
    }

    return "bg-emerald-500/10 text-emerald-400";
  }

  function statusIcon(status: string) {
    if (status === "missed" || status === "false_alarm") {
      return (
        <AlertTriangle
          size={16}
          className={
            status === "missed"
              ? "mt-0.5 shrink-0 text-rose-400"
              : "mt-0.5 shrink-0 text-amber-300"
          }
        />
      );
    }

    return (
      <CheckCircle2
        size={16}
        className="mt-0.5 shrink-0 text-emerald-400"
      />
    );
  }

  const missed =
    data?.cases.filter(
      (item) => item.status === "missed"
    ).length ?? 0;

  const falseAlarms =
    data?.cases.filter(
      (item) => item.status === "false_alarm"
    ).length ?? 0;

  const detected =
    data?.cases.filter(
      (item) => item.status === "detected"
    ).length ?? 0;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-violet-400">
          <Layers3 size={15} />
          META MODEL INSPECTION
        </div>

        <h1 className="text-3xl font-bold text-white">
          Failure Explorer
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          {report.dataset} · Meta DINOv2 anomaly analysis
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-300">
          Failed to load DINOv2 cases: {error}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-[#131c2c] p-8 text-center text-slate-400">
          Loading Meta DINOv2 results...
        </div>
      ) : data ? (
        <>
          {/* METRICS */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Evaluated Images", String(data.total_cases)],
              ["Missed Defects", String(missed)],
              ["False Alarms", String(falseAlarms)],
              ["Accuracy", toPercent(data.metrics.accuracy)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-800 bg-[#131c2c] p-5"
              >
                <p className="text-xs text-slate-400">
                  {label}
                </p>

                <p className="mt-2 text-2xl font-bold text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* MODEL INFO */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-slate-300">
            <p>
              <strong>{data.model}</strong>
              {" · "}Historical evaluation results
              {" · "}Precision{" "}
              {toPercent(data.metrics.precision)}
              {" · "}Recall{" "}
              {toPercent(data.metrics.recall)}
              {" · "}F1{" "}
              {toPercent(data.metrics.f1_score)}
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Exploratory evaluation only.
              Independent validation has not been completed.
            </p>
          </div>

          {/* SUMMARY */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Detected defects:{" "}
              <strong className="text-emerald-400">
                {detected}
              </strong>
            </span>

            <span>
              Total failures:{" "}
              <strong className="text-rose-400">
                {data.total_failures}
              </strong>
            </span>
          </div>

          {/* MAIN CONTENT */}
          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* LEFT: CASE LIST */}
            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#131c2c]">
              <div className="space-y-3 border-b border-slate-800 p-4">
                <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3">
                  <Search
                    size={17}
                    className="shrink-0 text-slate-500"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search inspection..."
                    className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>

                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                >
                  <option value="all">All cases</option>
                  <option value="missed">Missed defects</option>
                  <option value="false_alarm">False alarms</option>
                  <option value="detected">Detected defects</option>
                  <option value="correct_normal">
                    Correct normal
                  </option>
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
                      {statusIcon(item.status)}

                      <span className="break-all text-xs leading-5 text-white">
                        {item.sample_id}
                      </span>
                    </div>

                    <span
                      className={`mt-2 inline-block rounded-md px-2 py-1 text-xs capitalize ${statusColor(
                        item.status
                      )}`}
                    >
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </button>
                ))}

                {filtered.length === 0 && (
                  <p className="p-5 text-center text-sm text-slate-400">
                    No matching inspections found.
                  </p>
                )}
              </div>
            </section>

            {/* RIGHT: SELECTED CASE */}
            <section className="min-w-0 rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
              {selected ? (
                <div className="space-y-6">
                  {/* CASE HEADER */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="break-all text-lg font-semibold text-white">
                        {selected.sample_id}
                      </h2>

                      <p className="mt-2 text-sm text-slate-400">
                        Category: {selected.category}
                      </p>
                    </div>

                    <span
                      className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize ${statusColor(
                        selected.status
                      )}`}
                    >
                      {selected.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  {/* ORIGINAL + DINOv2 HEATMAP */}
                  <div className="grid gap-4 xl:grid-cols-2">
                    {/* ORIGINAL IMAGE */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white">
                        Original Inspection Image
                      </h3>

                      <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl bg-white p-4">
                        {imageError ? (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <ImageIcon size={18} />
                            Original image unavailable
                          </div>
                        ) : (
                          <img
                            key={selected.sample_id}
                            src={getInspectionImageUrl(
                              selected.sample_id
                            )}
                            alt={`Original inspection ${selected.sample_id}`}
                            className="max-h-[360px] max-w-full object-contain"
                            onError={() =>
                              setImageError(true)
                            }
                          />
                        )}
                      </div>
                    </div>

                    {/* DINOv2 HEATMAP */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white">
                        Meta DINOv2 Patch Heatmap
                      </h3>

                      <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl bg-white p-4">
                        {heatmapError ? (
                          <div className="text-center">
                            <AlertTriangle
                              size={24}
                              className="mx-auto text-amber-500"
                            />

                            <p className="mt-3 text-sm text-slate-600">
                              DINOv2 heatmap not available.
                            </p>
                          </div>
                        ) : (
                          <img
                            key={selected.sample_id}
                            src={getDinov2HeatmapUrl(
                              selected.sample_id
                            )}
                            alt={`DINOv2 anomaly heatmap ${selected.sample_id}`}
                            className="max-h-[360px] max-w-full object-contain"
                            onError={() =>
                              setHeatmapError(true)
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* HEATMAP DISCLAIMER */}
                  <p className="text-xs leading-5 text-slate-500">
                    Red regions indicate relatively higher
                    DINOv2 patch-feature distances from the
                    normal reference. Each heatmap is normalized
                    independently. These overlays are exploratory
                    visualizations, not validated defect
                    segmentation masks.
                  </p>

                  {/* SCORES */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
                      <p className="text-xs text-slate-400">
                        DINOv2 Anomaly Score
                      </p>

                      <p className="mt-3 text-2xl font-bold text-white">
                        {selected.prediction.anomaly_score.toFixed(
                          4
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
                      <p className="text-xs text-slate-400">
                        Prediction Changes / 4 Transforms
                      </p>

                      <p className="mt-3 text-2xl font-bold text-white">
                        {selected.prediction_changes}
                      </p>
                    </div>
                  </div>

                  {/* PREDICTION AND TRUTH */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                      <p className="text-xs text-slate-400">
                        Ground Truth
                      </p>

                      <p
                        className={`mt-3 text-sm font-semibold ${
                          selected.actual_defect
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {selected.actual_defect
                          ? "DEFECTIVE"
                          : "NORMAL"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                      <p className="text-xs text-slate-400">
                        Meta DINOv2 Prediction
                      </p>

                      <p
                        className={`mt-3 text-sm font-semibold ${
                          selected.prediction.predicted_defect
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {selected.prediction.predicted_defect
                          ? "DEFECT DETECTED"
                          : "NO DEFECT DETECTED"}
                      </p>
                    </div>
                  </div>

                  {/* FINAL NOTE */}
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs leading-6 text-slate-400">
                    This inspection uses saved evaluation results
                    generated by Meta DINOv2 ViT-S/14.
                    The heatmap is derived from DINOv2 patch
                    embeddings, whereas the image-level anomaly
                    score is based on global embeddings.

                    <p className="mt-2">
                      Independent validation has not yet been
                      completed. The results should not be
                      interpreted as production-ready defect
                      detection.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[350px] items-center justify-center text-slate-400">
                  No inspection case selected.
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#131c2c] p-6 text-slate-400">
          No DINOv2 evaluation data available.
        </div>
      )}
    </div>
  );
}
