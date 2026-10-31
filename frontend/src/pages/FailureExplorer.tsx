
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

  useEffect(() => {
    let active = true;

    getDinov2Cases()
      .then((response) => {
        if (!active) return;

        setData(response);
        setSelected(
          response.cases.find((item) => item.status === "missed") ??
          response.cases[0] ??
          null
        );
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
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

      return matchesSearch &&
        (filter === "all" || item.status === filter);
    });
  }, [data, search, filter]);

  function selectCase(item: Dinov2Case) {
    setSelected(item);
    setImageError(false);
  }

  function statusColor(status: string) {
    if (status === "missed") {
      return "bg-rose-500/10 text-rose-400";
    }

    if (status === "false_alarm") {
      return "bg-amber-500/10 text-amber-300";
    }

    return "bg-emerald-500/10 text-emerald-400";
  }

  const missed = data?.cases.filter(
    (item) => item.status === "missed"
  ).length ?? 0;

  const falseAlarms = data?.cases.filter(
    (item) => item.status === "false_alarm"
  ).length ?? 0;

  return (
    <div className="space-y-6">
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

      {error && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-300">
          Failed to load DINOv2 cases: {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-[#131c2c] p-8 text-center text-slate-400">
          Loading Meta DINOv2 results...
        </div>
      ) : data ? (
        <>
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
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-slate-300">
            <strong>{data.model}</strong> · Historical evaluation
            results · Precision {toPercent(data.metrics.precision)}
            {" · "}Recall {toPercent(data.metrics.recall)}
            {" · "}F1 {toPercent(data.metrics.f1_score)}
            <p className="mt-2 text-xs text-slate-400">
              Exploratory evaluation only. Independent validation
              has not been completed.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#131c2c]">
              <div className="space-y-3 border-b border-slate-800 p-4">
                <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3">
                  <Search size={17} className="text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search inspection..."
                    className="w-full bg-transparent py-3 text-sm text-white outline-none"
                  />
                </div>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                >
                  <option value="all">All cases</option>
                  <option value="missed">Missed defects</option>
                  <option value="false_alarm">False alarms</option>
                  <option value="detected">Detected defects</option>
                  <option value="correct_normal">Correct normal</option>
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
                      {item.status === "missed" ||
                      item.status === "false_alarm" ? (
                        <AlertTriangle
                          size={16}
                          className="mt-0.5 shrink-0 text-rose-400"
                        />
                      ) : (
                        <CheckCircle2
                          size={16}
                          className="mt-0.5 shrink-0 text-emerald-400"
                        />
                      )}

                      <span className="break-all text-xs text-white">
                        {item.sample_id}
                      </span>
                    </div>

                    <span className={`mt-2 inline-block rounded-md px-2 py-1 text-xs capitalize ${statusColor(item.status)}`}>
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </button>
                ))}

                {filtered.length === 0 && (
                  <p className="p-5 text-sm text-slate-400">
                    No matching inspections.
                  </p>
                )}
              </div>
            </section>

            <section className="min-w-0 rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
              {selected ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="break-all text-lg font-semibold text-white">
                        {selected.sample_id}
                      </h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Category: {selected.category}
                      </p>
                    </div>

                    <span className={`h-fit rounded-lg px-3 py-2 text-xs capitalize ${statusColor(selected.status)}`}>
                      {selected.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl bg-white p-4">
                    {imageError ? (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <ImageIcon size={18} />
                        Image unavailable
                      </div>
                    ) : (
                      <img
                        key={selected.sample_id}
                        src={getInspectionImageUrl(selected.sample_id)}
                        alt={selected.sample_id}
                        className="max-h-[360px] max-w-full object-contain"
                        onError={() => setImageError(true)}
                      />
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-900 p-4">
                      <p className="text-xs text-slate-400">
                        DINOv2 anomaly score
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">
                        {selected.prediction.anomaly_score.toFixed(4)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-900 p-4">
                      <p className="text-xs text-slate-400">
                        Prediction changes / 4 transforms
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">
                        {selected.prediction_changes}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">
                    <p>
                      Ground truth:{" "}
                      <strong>
                        {selected.actual_defect ? "DEFECT" : "NORMAL"}
                      </strong>
                    </p>
                    <p className="mt-2">
                      DINOv2 prediction:{" "}
                      <strong>
                        {selected.prediction.predicted_defect
                          ? "DEFECT"
                          : "NORMAL"}
                      </strong>
                    </p>
                  </div>

                  <p className="text-xs leading-5 text-slate-500">
                    Scores are produced by Meta DINOv2 ViT-S/14.
                    This view uses saved evaluation results, not
                    live inference. DINOv2 patch heatmaps will
                    be added separately.
                  </p>
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
        <div className="rounded-xl bg-slate-900 p-6 text-slate-400">
          No DINOv2 evaluation data available.
        </div>
      )}
    </div>
  );
}
