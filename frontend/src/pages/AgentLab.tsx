
import { useEffect, useState } from "react";
import BatchScan from "../components/BatchScan";

import {
  Play,
  ShieldAlert,
  ShieldCheck,
  Bot,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from "lucide-react";

import {
  getDinov2Cases,
  runRedAgent,
  getInspectionImageUrl,
} from "../services/api";

import type {
  FaultForgeReport,
  Dinov2Case,
  RedAgentResult,
} from "../services/api";

interface Props {
  report: FaultForgeReport;
}

const labels: Record<string, string> = {
  original: "Original",
  dark: "Dark",
  bright: "Bright",
  low_contrast: "Low Contrast",
  high_contrast: "High Contrast",
};

export default function AgentLab({ report }: Props) {
  const [cases, setCases] = useState<Dinov2Case[]>([]);
  const [sampleId, setSampleId] = useState("");
  const [result, setResult] = useState<RedAgentResult | null>(null);

  const [loadingCases, setLoadingCases] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getDinov2Cases()
      .then((data) => {
        if (!active) return;

        setCases(data.cases);

        const preferred = data.cases.find(
          (item) =>
            item.sample_id === "test/broken_small/007.png"
        );

        setSampleId(
          preferred?.sample_id ??
          data.cases[0]?.sample_id ??
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
        if (active) setLoadingCases(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleRun() {
    if (!sampleId || running) return;

    setRunning(true);
    setError("");
    setResult(null);

    try {
      const response = await runRedAgent(sampleId);
      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setRunning(false);
    }
  }

  const incorrect = result?.incorrect_predictions ?? 0;
  const flips = result?.prediction_flips ?? 0;

  return (
    <div className="space-y-7">
      {/* HEADER */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-violet-400">
          META-POWERED ADVERSARIAL TESTING
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">
          Agent Lab
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Discover model weaknesses through controlled
          perturbations and live Meta DINOv2 inference.
        </p>
      </div>

      {/* AGENT OVERVIEW */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-rose-500/30 bg-[#131c2c] p-5">
          <ShieldAlert size={23} className="text-rose-400" />

          <h3 className="mt-3 font-semibold text-white">
            Red Agent
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Active. Runs controlled visual tests using real
            Meta DINOv2 inference and detects prediction flips
            and incorrect predictions.
          </p>

          <span className="mt-4 inline-block rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            Operational
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <Bot size={23} className="text-violet-400" />

          <h3 className="mt-3 font-semibold text-white">
            Blue Agent
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Planned. Will explore improvement strategies
            based on observed failure patterns.
          </p>

          <span className="mt-4 inline-block rounded-lg bg-slate-700/50 px-3 py-1 text-xs text-slate-400">
            Not implemented
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <ShieldCheck
            size={23}
            className="text-emerald-400"
          />

          <h3 className="mt-3 font-semibold text-white">
            Verification Gate
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Historical gate decision:{" "}
            {report.verification.decision}.
            Independent DINOv2 validation is not yet
            implemented.
          </p>
        </div>
      </div>

      {/* RED AGENT EXECUTION */}
      <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
        <div className="flex items-center gap-3">
          <Activity size={21} className="text-violet-400" />

          <h2 className="text-xl font-semibold text-white">
            Run Red Agent
          </h2>
        </div>

        <p className="mt-2 text-sm text-slate-400">
          Select an inspection image and execute five
          live DINOv2 tests: original, dark, bright,
          low contrast and high contrast.
        </p>

        <div className="mt-6 flex flex-col gap-4 md:flex-row">
          <select
            value={sampleId}
            onChange={(event) => {
              setSampleId(event.target.value);
              setResult(null);
              setError("");
            }}
            disabled={loadingCases || running}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white"
          >
            {cases.length === 0 && (
              <option value="">
                {loadingCases
                  ? "Loading samples..."
                  : "No samples available"}
              </option>
            )}

            {cases.map((item) => (
              <option
                key={item.sample_id}
                value={item.sample_id}
              >
                {item.sample_id}
              </option>
            ))}
          </select>

          <button
            onClick={handleRun}
            disabled={!sampleId || running || loadingCases}
            className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {running ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Play size={18} />
            )}

            {running ? "Running Red Agent..." : "Run Red Agent"}
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          The model runs locally on CPU. The first execution
          may load Meta DINOv2 into memory; subsequent
          executions reuse the cached model.
          Test transformations are deterministic.
        </p>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            <AlertTriangle
              size={18}
              className="shrink-0"
            />

            <span>{error}</span>
          </div>
        )}
      </section>

      {/* RED AGENT RESULTS */}
      {result && (
        <section className="space-y-6 rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Red Agent Results
            </h2>

            <p className="mt-2 break-all text-sm text-slate-400">
              {result.sample_id} · {result.model}
            </p>

            <p className="mt-2 text-xs text-emerald-400">
              Live Meta model inference completed
            </p>
          </div>

          {/* METRICS */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total Tests", String(result.total_tests)],
              ["Incorrect Predictions", String(incorrect)],
              ["Prediction Flips", String(flips)],
              ["Threshold", result.threshold.toFixed(4)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-slate-900 p-4"
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

          {/* IMAGE AND SUMMARY */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-4">
              <img
                src={getInspectionImageUrl(result.sample_id)}
                alt={`Inspection ${result.sample_id}`}
                className="mx-auto max-h-[300px] object-contain"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="font-semibold text-white">
                Failure Discovery Summary
              </h3>

              <p className="mt-4 text-sm text-slate-300">
                Original prediction:{" "}
                <strong>
                  {result.original_prediction
                    ? "DEFECT"
                    : "NORMAL"}
                </strong>
              </p>

              <p className="mt-3 text-sm text-slate-300">
                Ground truth:{" "}
                <strong>
                  {result.actual_defect === null
                    ? "UNKNOWN"
                    : result.actual_defect
                    ? "DEFECT"
                    : "NORMAL"}
                </strong>
              </p>

              <p className="mt-3 text-sm text-slate-300">
                Incorrect predictions:{" "}
                <strong className="text-rose-400">
                  {incorrect}
                </strong>
              </p>

              <p className="mt-3 text-sm text-slate-300">
                Prediction flips:{" "}
                <strong className="text-violet-400">
                  {flips}
                </strong>
              </p>

              <p className="mt-4 text-xs leading-5 text-slate-400">
                Conditions with incorrect predictions:{" "}
                {result.worst_conditions.length > 0
                  ? result.worst_conditions
                      .map((name) => labels[name] ?? name)
                      .join(", ")
                  : "None detected"}
              </p>
            </div>
          </div>

          {/* TEST RESULTS TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="py-4 font-medium">
                    Condition
                  </th>

                  <th className="py-4 font-medium">
                    Anomaly Score
                  </th>

                  <th className="py-4 font-medium">
                    Prediction
                  </th>

                  <th className="py-4 font-medium">
                    Flip?
                  </th>

                  <th className="py-4 font-medium">
                    Correct?
                  </th>
                </tr>
              </thead>

              <tbody>
                {result.tests.map((test) => (
                  <tr
                    key={test.condition}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="py-4 text-white">
                      {labels[test.condition] ??
                        test.condition}
                    </td>

                    <td className="py-4 font-mono text-slate-300">
                      {test.anomaly_score.toFixed(4)}
                    </td>

                    <td className="py-4 text-slate-300">
                      {test.predicted_defect
                        ? "Defect detected"
                        : "No defect"}
                    </td>

                    <td className="py-4">
                      <span
                        className={
                          test.prediction_flip
                            ? "text-amber-300"
                            : "text-slate-400"
                        }
                      >
                        {test.prediction_flip
                          ? "Yes"
                          : "No"}
                      </span>
                    </td>

                    <td className="py-4">
                      {test.correct === null ? (
                        <span className="text-slate-400">
                          Unknown
                        </span>
                      ) : (
                        <span
                          className={`flex items-center gap-2 ${
                            test.correct
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {test.correct ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}

                          {test.correct ? "Yes" : "No"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DISCLAIMER */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs leading-6 text-slate-400">
            Red Agent executes real Meta DINOv2 inference
            using deterministic visual perturbations.
            Prediction flips reveal sensitivity to
            transformations, not necessarily adversarial
            attacks. This is exploratory evaluation;
            independent validation is not yet complete.
          </div>
        </section>
      )}

      {/* EXISTING BATCH SCAN */}
      <BatchScan />
    </div>
  );
}
