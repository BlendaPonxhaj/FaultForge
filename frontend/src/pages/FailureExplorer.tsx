
import { useEffect, useMemo, useState } from "react";

import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
} from "lucide-react";

import {
  getDinov2Cases,
  getDinov2HeatmapUrl,
  getInspectionImageUrl,
  toPercent,
} from "../services/api";

import type {
  Dinov2Case,
  Dinov2CasesResponse,
} from "../services/api";

type Filter =
  | "all"
  | "missed"
  | "false_alarm"
  | "detected"
  | "correct_normal";

const filterLabels: Record<Filter, string> = {
  all: "All Cases",
  missed: "Missed Defects",
  false_alarm: "False Alarms",
  detected: "Detected Defects",
  correct_normal: "Correct Normal",
};

const statusLabels: Record<Dinov2Case["status"], string> = {
  missed: "Missed Defect",
  false_alarm: "False Alarm",
  detected: "Detected",
  correct_normal: "Correct Normal",
};

function statusColor(status: Dinov2Case["status"]) {
  switch (status) {
    case "missed":
      return "text-rose-400";
    case "false_alarm":
      return "text-amber-400";
    case "detected":
      return "text-emerald-400";
    case "correct_normal":
      return "text-sky-400";
  }
}

export default function FailureExplorer() {
  const [data, setData] =
    useState<Dinov2CasesResponse | null>(null);

  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

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

        const firstMissed = response.cases.find(
          (item) => item.status === "missed"
        );

        setSelectedId(
          firstMissed?.sample_id ??
            response.cases[0]?.sample_id ??
            ""
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
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredCases = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();

    return data.cases.filter((item) => {
      const matchesFilter =
        filter === "all" || item.status === filter;

      const matchesSearch =
        query.length === 0 ||
        item.sample_id.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [data, filter, search]);

  const selectedCase = data?.cases.find(
    (item) => item.sample_id === selectedId
  );

  function selectCase(sampleId: string) {
    setSelectedId(sampleId);
    setImageError(false);
    setHeatmapError(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-8 text-slate-300">
        <LoaderCircle
          size={20}
          className="animate-spin text-violet-400"
        />
        Loading DINOv2 failure cases...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6">
        <h2 className="font-semibold text-rose-300">
          Failure Explorer Unavailable
        </h2>

        <p className="mt-2 text-sm text-slate-300">
          {error || "Failed to load DINOv2 cases."}
        </p>
      </div>
    );
  }

  const missedCount = data.cases.filter(
    (item) => item.status === "missed"
  ).length;

  const falseAlarmCount = data.cases.filter(
    (item) => item.status === "false_alarm"
  ).length;

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold tracking-widest text-violet-400">
          META DINOv2 FAILURE ANALYSIS
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">
          Failure Explorer
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Inspect anomaly predictions, failure cases,
          and spatial patch-distance visualizations.
        </p>

        <p className="mt-2 text-xs text-amber-300">
          Exploratory evaluation — not independent validation
        </p>
      </div>

      {/* SUMMARY METRICS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <p className="text-xs text-slate-400">
            Total Cases
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {data.total_cases}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <p className="text-xs text-slate-400">
            Missed Defects
          </p>
          <p className="mt-2 text-3xl font-bold text-rose-400">
            {missedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <p className="text-xs text-slate-400">
            False Alarms
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-400">
            {falseAlarmCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <p className="text-xs text-slate-400">
            DINOv2 Accuracy
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {toPercent(data.metrics.accuracy)}
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* CASE LIST */}
        <section className="min-w-0 rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <h2 className="text-lg font-semibold text-white">
            Inspection Cases
          </h2>

          <div className="relative mt-4">
            <Search
              size={17}
              className="absolute left-3 top-3.5 text-slate-500"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sample ID..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as Filter)
            }
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white"
          >
            {(
              Object.entries(filterLabels) as [
                Filter,
                string,
              ][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <p className="mt-4 text-xs text-slate-500">
            Showing {filteredCases.length} of{" "}
            {data.cases.length} cases
          </p>

          <div className="mt-3 max-h-[600px] space-y-2 overflow-y-auto pr-1">
            {filteredCases.map((item) => (
              <button
                key={item.sample_id}
                onClick={() => selectCase(item.sample_id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === item.sample_id
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                }`}
              >
                <p className="break-all text-xs font-medium text-slate-200">
                  {item.sample_id}
                </p>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${statusColor(
                      item.status
                    )}`}
                  >
                    {statusLabels[item.status]}
                  </span>

                  <span className="text-xs text-slate-400">
                    Score:{" "}
                    {item.prediction.anomaly_score.toFixed(3)}
                  </span>
                </div>
              </button>
            ))}

            {filteredCases.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No matching cases.
              </p>
            )}
          </div>
        </section>

        {/* CASE DETAIL */}
        <section className="min-w-0 space-y-6 rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          {!selectedCase ? (
            <p className="text-sm text-slate-400">
              Select an inspection case to see details.
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold tracking-widest text-violet-400">
                  SELECTED CASE
                </p>

                <h2 className="mt-2 break-all text-lg font-semibold text-white">
                  {selectedCase.sample_id}
                </h2>

                <p
                  className={`mt-2 text-sm font-semibold ${statusColor(
                    selectedCase.status
                  )}`}
                >
                  {statusLabels[selectedCase.status]}
                </p>
              </div>

              {/* ORIGINAL AND DINOv2 HEATMAP */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <ImageIcon
                      size={17}
                      className="text-sky-400"
                    />
                    Original Image
                  </div>

                  <div className="flex min-h-[270px] items-center justify-center rounded-lg bg-white p-3">
                    {imageError ? (
                      <p className="text-center text-sm text-slate-700">
                        Original image unavailable.
                      </p>
                    ) : (
                      <img
                        key={selectedCase.sample_id}
                        src={getInspectionImageUrl(
                          selectedCase.sample_id
                        )}
                        alt="Original inspection"
                        onError={() => setImageError(true)}
                        className="max-h-[330px] w-full object-contain"
                      />
                    )}
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Layers3
                      size={17}
                      className="text-violet-400"
                    />
                    Meta DINOv2 Heatmap
                  </div>

                  <div className="flex min-h-[270px] items-center justify-center rounded-lg bg-white p-3">
                    {heatmapError ? (
                      <p className="text-center text-sm text-slate-700">
                        DINOv2 heatmap unavailable.
                      </p>
                    ) : (
                      <img
                        key={selectedCase.sample_id}
                        src={getDinov2HeatmapUrl(
                          selectedCase.sample_id
                        )}
                        alt="DINOv2 patch anomaly heatmap"
                        onError={() => setHeatmapError(true)}
                        className="max-h-[330px] w-full object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* PREDICTION DETAILS */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-xs text-slate-400">
                    Ground Truth
                  </p>

                  <p className="mt-2 text-xl font-bold text-white">
                    {selectedCase.actual_defect
                      ? "Defective"
                      : "Normal"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-xs text-slate-400">
                    DINOv2 Prediction
                  </p>

                  <p className="mt-2 text-xl font-bold text-white">
                    {selectedCase.prediction.predicted_defect
                      ? "Defective"
                      : "Normal"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-xs text-slate-400">
                    Global Anomaly Score
                  </p>

                  <p className="mt-2 text-xl font-bold text-white">
                    {selectedCase.prediction.anomaly_score.toFixed(
                      4
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-xs text-slate-400">
                    Changed Predictions
                  </p>

                  <p className="mt-2 text-xl font-bold text-violet-400">
                    {selectedCase.prediction_changes} / 4
                  </p>
                </div>
              </div>

              {selectedCase.status === "missed" ||
              selectedCase.status === "false_alarm" ? (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <AlertTriangle
                    size={19}
                    className="shrink-0 text-rose-400"
                  />

                  <div>
                    <p className="font-semibold text-rose-300">
                      Model Failure
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      The DINOv2 global prediction does not
                      match the ground-truth label.
                    </p>
                    {selectedCase.failure_type && (
                      <p className="mt-2 text-xs text-slate-400">
                        Failure type:{" "}
                        {selectedCase.failure_type.replaceAll(
                          "_",
                          " "
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <CheckCircle2
                    size={19}
                    className="text-emerald-400"
                  />
                  <p className="text-sm text-emerald-300">
                    The global prediction matches the
                    ground-truth label.
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs leading-6 text-slate-400">
                The heatmap shows relative spatial patch
                distances from a normal-image reference.
                It is not a validated segmentation mask.
                Heatmap intensity and the global anomaly
                score are different measurements.
                These results are exploratory.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
