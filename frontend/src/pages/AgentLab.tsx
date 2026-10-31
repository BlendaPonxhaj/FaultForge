
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
  runBlueAgent,
  getDinov2Verification,
  getInspectionImageUrl,
} from "../services/api";

import type {
  Dinov2Case,
  RedAgentResult,
  BlueAgentResult,
  Dinov2VerificationResult,
} from "../services/api";

const labels: Record<string, string> = {
  original: "Original",
  dark: "Dark",
  bright: "Bright",
  low_contrast: "Low Contrast",
  high_contrast: "High Contrast",
};

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function displayName(value: string): string {
  return value.replaceAll("_", " ");
}

export default function AgentLab() {
  const [cases, setCases] = useState<Dinov2Case[]>([]);
  const [sampleId, setSampleId] = useState("");

  const [redResult, setRedResult] =
    useState<RedAgentResult | null>(null);

  const [blueResult, setBlueResult] =
    useState<BlueAgentResult | null>(null);

  const [verification, setVerification] =
    useState<Dinov2VerificationResult | null>(null);

  const [loadingCases, setLoadingCases] = useState(true);
  const [runningRed, setRunningRed] = useState(false);
  const [runningBlue, setRunningBlue] = useState(false);
  const [verificationLoading, setVerificationLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [verificationError, setVerificationError] =
    useState("");

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

  useEffect(() => {
    let active = true;

    getDinov2Verification()
      .then((data) => {
        if (active) setVerification(data);
      })
      .catch((err) => {
        if (active) {
          setVerificationError(
            err instanceof Error ? err.message : String(err)
          );
        }
      })
      .finally(() => {
        if (active) setVerificationLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function handleSampleChange(value: string) {
    setSampleId(value);
    setRedResult(null);
    setBlueResult(null);
    setError("");
  }

  async function handleRunRed() {
    if (!sampleId || runningRed || runningBlue) return;

    setRunningRed(true);
    setError("");
    setRedResult(null);

    try {
      const data = await runRedAgent(sampleId);
      setRedResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setRunningRed(false);
    }
  }

  async function handleRunBlue() {
    if (!sampleId || runningRed || runningBlue) return;

    setRunningBlue(true);
    setError("");
    setBlueResult(null);

    try {
      const data = await runBlueAgent(sampleId);
      setBlueResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setRunningBlue(false);
    }
  }

  const isRunning = runningRed || runningBlue;
  const verificationRejected =
    verification?.decision.includes("REJECT") ?? false;

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
          Discover model weaknesses and evaluate
          experimental defense strategies using real
          Meta DINOv2 inference.
        </p>
      </div>

      {/* OVERVIEW CARDS */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-rose-500/30 bg-[#131c2c] p-5">
          <ShieldAlert
            size={23}
            className="text-rose-400"
          />

          <h3 className="mt-3 font-semibold text-white">
            Red Agent
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Executes deterministic image transformations
            and discovers incorrect DINOv2 predictions
            and prediction flips.
          </p>

          <span className="mt-4 inline-block rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            Operational
          </span>
        </div>

        <div className="rounded-2xl border border-indigo-500/30 bg-[#131c2c] p-5">
          <Bot
            size={23}
            className="text-indigo-400"
          />

          <h3 className="mt-3 font-semibold text-white">
            Blue Agent
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Tests an experimental multi-view majority
            vote strategy using five DINOv2 predictions.
          </p>

          <span className="mt-4 inline-block rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            Experimental
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <ShieldCheck
            size={23}
            className={
              verificationRejected
                ? "text-rose-400"
                : "text-emerald-400"
            }
          />

          <h3 className="mt-3 font-semibold text-white">
            Verification Gate
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Compares DINOv2 baseline predictions
            against Blue Agent consensus across the
            evaluation dataset.
          </p>

          <span
            className={`mt-4 inline-block rounded-lg px-3 py-1 text-xs font-semibold ${
              verificationRejected
                ? "bg-rose-500/10 text-rose-300"
                : "bg-slate-700/50 text-slate-300"
            }`}
          >
            {verificationLoading
              ? "Loading..."
              : verification
                ? displayName(verification.decision)
                : "Report unavailable"}
          </span>
        </div>
      </div>

      {/* AGENT EXECUTION */}
      <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
        <div className="flex items-center gap-3">
          <Activity
            size={21}
            className="text-violet-400"
          />

          <h2 className="text-xl font-semibold text-white">
            Run AI Agents
          </h2>
        </div>

        <p className="mt-2 text-sm text-slate-400">
          Select an inspection image to discover model
          weaknesses or evaluate the Blue Agent strategy.
        </p>

        <div className="mt-6">
          <label
            htmlFor="sample-selector"
            className="mb-2 block text-xs font-medium text-slate-400"
          >
            Inspection Sample
          </label>

          <select
            id="sample-selector"
            value={sampleId}
            onChange={(event) =>
              handleSampleChange(event.target.value)
            }
            disabled={loadingCases || isRunning}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white"
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
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleRunRed}
            disabled={!sampleId || isRunning || loadingCases}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {runningRed ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Play size={18} />
            )}

            {runningRed
              ? "Running Red Agent..."
              : "Run Red Agent"}
          </button>

          <button
            onClick={handleRunBlue}
            disabled={!sampleId || isRunning || loadingCases}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {runningBlue ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Bot size={18} />
            )}

            {runningBlue
              ? "Running Blue Agent..."
              : "Run Blue Agent"}
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Both agents use Meta DINOv2 inference running
          locally on CPU. Red Agent applies deterministic
          perturbations. Blue Agent evaluates a rule-based
          majority-voting strategy.
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
      {redResult && (
        <section className="space-y-6 rounded-2xl border border-rose-500/20 bg-[#131c2c] p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Red Agent — Failure Discovery
            </h2>

            <p className="mt-2 break-all text-sm text-slate-400">
              {redResult.sample_id} · {redResult.model}
            </p>

            <p className="mt-2 text-xs text-emerald-400">
              Meta DINOv2 inference completed
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Total Tests
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {redResult.total_tests}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Incorrect Predictions
              </p>
              <p className="mt-2 text-2xl font-bold text-rose-400">
                {redResult.incorrect_predictions}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Prediction Flips
              </p>
              <p className="mt-2 text-2xl font-bold text-violet-400">
                {redResult.prediction_flips}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Detection Threshold
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {redResult.threshold.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex items-center justify-center rounded-xl bg-white p-4">
              <img
                src={getInspectionImageUrl(
                  redResult.sample_id
                )}
                alt={`Inspection ${redResult.sample_id}`}
                className="max-h-[300px] w-full object-contain"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="font-semibold text-white">
                Failure Summary
              </h3>

              <p className="mt-4 text-sm text-slate-300">
                Original prediction:{" "}
                <strong>
                  {redResult.original_prediction
                    ? "Defect"
                    : "Normal"}
                </strong>
              </p>

              <p className="mt-3 text-sm text-slate-300">
                Ground truth:{" "}
                <strong>
                  {redResult.actual_defect === null
                    ? "Unknown"
                    : redResult.actual_defect
                      ? "Defect"
                      : "Normal"}
                </strong>
              </p>

              <p className="mt-3 text-sm text-slate-300">
                Prediction flips:{" "}
                <strong className="text-violet-400">
                  {redResult.prediction_flips}
                </strong>
              </p>

              <p className="mt-4 text-xs leading-5 text-slate-400">
                Incorrect conditions:{" "}
                {redResult.worst_conditions.length > 0
                  ? redResult.worst_conditions
                      .map((condition) =>
                        labels[condition] ?? condition
                      )
                      .join(", ")
                  : "None"}
              </p>
            </div>
          </div>

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
                {redResult.tests.map((test) => (
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

          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs leading-6 text-slate-400">
            Red Agent performs real Meta DINOv2 inference
            with deterministic perturbations. Prediction
            flips indicate model sensitivity, not necessarily
            adversarial attacks. Independent validation
            has not been completed.
          </div>
        </section>
      )}

      {/* BLUE AGENT RESULTS */}
      {blueResult && (
        <section className="space-y-6 rounded-2xl border border-indigo-500/30 bg-[#131c2c] p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Blue Agent — Strategy Evaluation
            </h2>

            <p className="mt-2 break-all text-sm text-slate-400">
              {blueResult.sample_id} · {blueResult.model}
            </p>

            <p className="mt-2 text-xs text-indigo-400">
              Strategy: Multi-view majority vote
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Baseline Prediction
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {blueResult.baseline_prediction
                  ? "Defect"
                  : "Normal"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Consensus Prediction
              </p>
              <p className="mt-2 text-xl font-bold text-indigo-400">
                {blueResult.consensus_prediction
                  ? "Defect"
                  : "Normal"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Defect Votes
              </p>
              <p className="mt-2 text-2xl font-bold text-rose-400">
                {blueResult.defect_votes}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Normal Votes
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {blueResult.normal_votes}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="font-semibold text-white">
              Strategy Comparison
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">
                  Decision Changed
                </p>
                <p className="mt-2 font-semibold text-white">
                  {blueResult.changed_decision ? "Yes" : "No"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Comparison
                </p>
                <p className="mt-2 font-semibold text-indigo-300">
                  {displayName(blueResult.comparison)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Ground Truth
                </p>
                <p className="mt-2 font-semibold text-white">
                  {blueResult.actual_defect === null
                    ? "Unknown"
                    : blueResult.actual_defect
                      ? "Defect"
                      : "Normal"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Strategy Approved
                </p>
                <p className="mt-2 font-semibold text-amber-300">
                  {blueResult.strategy_approved
                    ? "Yes"
                    : "No"}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
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
                </tr>
              </thead>

              <tbody>
                {blueResult.votes.map((vote) => (
                  <tr
                    key={vote.condition}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="py-4 text-white">
                      {labels[vote.condition] ??
                        vote.condition}
                    </td>

                    <td className="py-4 font-mono text-slate-300">
                      {vote.anomaly_score.toFixed(4)}
                    </td>

                    <td
                      className={
                        vote.predicted_defect
                          ? "py-4 text-rose-400"
                          : "py-4 text-emerald-400"
                      }
                    >
                      {vote.predicted_defect
                        ? "Defect"
                        : "Normal"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-6 text-slate-400">
            {blueResult.note}
          </div>
        </section>
      )}

      {/* VERIFICATION GATE */}
      <section className="space-y-6 rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck
            size={24}
            className={
              verificationRejected
                ? "text-rose-400"
                : "text-emerald-400"
            }
          />

          <div>
            <h2 className="text-xl font-semibold text-white">
              Verification Gate
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Meta DINOv2 baseline vs. Blue Agent
              multi-view consensus
            </p>
          </div>
        </div>

        {verificationLoading && (
          <p className="text-sm text-slate-400">
            Loading verification report...
          </p>
        )}

        {verificationError && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            {verificationError}
          </div>
        )}

        {verification && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  verificationRejected
                    ? "bg-rose-500/10 text-rose-300"
                    : "bg-amber-500/10 text-amber-300"
                }`}
              >
                {displayName(verification.decision)}
              </span>

              <span className="text-sm text-slate-400">
                {verification.samples_evaluated} images evaluated
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-3 font-medium">
                      Metric
                    </th>
                    <th className="py-3 font-medium">
                      DINOv2 Baseline
                    </th>
                    <th className="py-3 font-medium">
                      Blue Agent
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(
                    [
                      ["Accuracy", "accuracy"],
                      ["Precision", "precision"],
                      ["Recall", "recall"],
                      ["False Alarm Rate", "false_alarm_rate"],
                    ] as const
                  ).map(([label, key]) => (
                    <tr
                      key={key}
                      className="border-b border-slate-800"
                    >
                      <td className="py-3 text-white">
                        {label}
                      </td>
                      <td className="py-3 text-slate-300">
                        {formatPercentage(
                          verification.baseline[key]
                        )}
                      </td>
                      <td className="py-3 text-indigo-300">
                        {formatPercentage(
                          verification.candidate_metrics[key]
                        )}
                      </td>
                    </tr>
                  ))}

                  {(
                    [
                      ["True Positives", "tp"],
                      ["True Negatives", "tn"],
                      ["False Positives", "fp"],
                      ["False Negatives", "fn"],
                    ] as const
                  ).map(([label, key]) => (
                    <tr
                      key={key}
                      className="border-b border-slate-800"
                    >
                      <td className="py-3 text-white">
                        {label}
                      </td>
                      <td className="py-3 text-slate-300">
                        {verification.baseline[key]}
                      </td>
                      <td className="py-3 text-indigo-300">
                        {verification.candidate_metrics[key]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-white">
                Verification Checks
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(verification.checks).map(
                  ([name, passed]) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 rounded-xl bg-slate-900 p-4"
                    >
                      {passed ? (
                        <CheckCircle2
                          size={18}
                          className="shrink-0 text-emerald-400"
                        />
                      ) : (
                        <AlertTriangle
                          size={18}
                          className="shrink-0 text-rose-400"
                        />
                      )}

                      <div>
                        <p className="text-sm text-slate-200">
                          {displayName(name)}
                        </p>
                        <p
                          className={
                            passed
                              ? "text-xs text-emerald-400"
                              : "text-xs text-rose-400"
                          }
                        >
                          {passed ? "PASS" : "FAIL"}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-900 p-4">
                <p className="text-xs text-slate-400">
                  New Missed Defects
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {verification.new_missed_defects.length}
                </p>
              </div>

              <div className="rounded-xl bg-slate-900 p-4">
                <p className="text-xs text-slate-400">
                  New False Alarms
                </p>
                <p className="mt-2 text-2xl font-bold text-rose-400">
                  {verification.new_false_alarms.length}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6 text-slate-400">
              The Blue Agent increased defect recall but
              introduced additional false alarms. The
              experimental Verification Gate rejected
              the candidate based on its configured checks.

              <p className="mt-2">
                Independent validation:{" "}
                {verification.independent_validation
                  ? "Yes"
                  : "No"}
                . Production approved:{" "}
                {verification.production_approved
                  ? "Yes"
                  : "No"}.
              </p>

              <p className="mt-2">
                These results use a dataset previously
                explored during development and do not
                constitute independent validation.
              </p>
            </div>
          </>
        )}
      </section>

      {/* EXISTING BATCH RELIABILITY */}
      <BatchScan />
    </div>
  );
}
