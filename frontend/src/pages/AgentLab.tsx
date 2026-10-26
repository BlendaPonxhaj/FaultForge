
import { useEffect, useState } from "react";
import BatchScan from "../components/BatchScan";
import {
  Play,
  ShieldAlert,
  ShieldCheck,
  Bot,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

import {
  getInspectionCases,
  runReliabilityTest
} from "../services/api";

import type {
  FaultForgeReport,
  InspectionCase,
  ReliabilityTestResult
} from "../services/api";

interface Props {
  report: FaultForgeReport;
}

const labels: Record<string, string> = {
  original: "Original",
  dark: "Dark",
  bright: "Bright",
  low_contrast: "Low Contrast",
  high_contrast: "High Contrast"
};

export default function AgentLab({ report }: Props) {
  const [cases, setCases] = useState<InspectionCase[]>([]);
  const [sampleId, setSampleId] = useState("");
  const [result, setResult] = useState<ReliabilityTestResult | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getInspectionCases()
      .then((items) => {
        setCases(items);

        const preferred = items.find(
          (item) =>
            item.sample_id === "test/broken_small/007.png"
        );

        setSampleId(
          preferred?.sample_id ??
          items[0]?.sample_id ??
          ""
        );
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : String(err)
        );
      })
      .finally(() => setLoadingCases(false));
  }, []);

  async function handleRun() {
    if (!sampleId || running) return;

    setRunning(true);
    setError("");
    setResult(null);

    try {
      const data = await runReliabilityTest(sampleId);
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold tracking-widest text-violet-400">
          ADVERSARIAL TESTING
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">
          Agent Lab
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Execute real visual robustness tests against the
          Global ResNet18 inspector.
        </p>
        
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <ShieldAlert size={23} className="text-rose-400" />

          <h3 className="mt-3 font-semibold text-white">
            Red Agent
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Generates controlled visual perturbations.
            Deterministic version operational.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <Bot size={23} className="text-violet-400" />

          <h3 className="mt-3 font-semibold text-white">
            Blue Agent
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Autonomous defense proposals are not
            implemented yet.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
          <ShieldCheck size={23} className="text-emerald-400" />

          <h3 className="mt-3 font-semibold text-white">
            Verification Gate
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Current model decision: {report.verification.decision}.
            This is exploratory verification.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
        <h2 className="text-xl font-semibold text-white">
          Run Reliability Test
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Select an inspection image. FaultForge will
          evaluate the original and four transformed versions.
        </p>

        <div className="mt-6 flex flex-col gap-4 md:flex-row">
          <select
            value={sampleId}
            onChange={(event) => {
              setSampleId(event.target.value);
              setResult(null);
            }}
            disabled={loadingCases || running}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white"
          >
            {cases.length === 0 && (
              <option value="">
                {loadingCases ? "Loading samples..." : "No samples available"}
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
            disabled={!sampleId || running}
            className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {running ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Play size={18} />
            )}

            {running ? "Running Test..." : "Run Reliability Test"}
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          The first test loads the pretrained ResNet18 and
          reconstructs its normal reference and calibration.
          Later tests reuse the cached model.
        </p>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {result && (
        <section className="space-y-5 rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Test Results
            </h2>

            <p className="mt-2 break-all text-sm text-slate-400">
              {result.sample_id} · {result.model}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Detection Threshold
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {result.threshold.toFixed(4)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Changed Predictions
              </p>
              <p className="mt-2 text-2xl font-bold text-violet-400">
                {result.changed_predictions}/{result.total_transformations}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">
                Ground Truth
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {result.actual_defect ? "Defective" : "Normal"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="py-4 font-medium">Condition</th>
                  <th className="py-4 font-medium">Anomaly Score</th>
                  <th className="py-4 font-medium">Prediction</th>
                  <th className="py-4 font-medium">Correct?</th>
                </tr>
              </thead>

              <tbody>
                {result.tests.map((test) => (
                  <tr
                    key={test.condition}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="py-4 text-white">
                      {labels[test.condition] ?? test.condition}
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
                      <span className={`flex items-center gap-2 ${
                        test.correct
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}>
                        {test.correct ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <AlertTriangle size={16} />
                        )}
                        {test.correct ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs leading-6 text-slate-400">
            {result.note}
            {" "}These results use synthetic visual
            transformations and are not independent
            production validation.
          </div>
        </section>
      )}
      <BatchScan />
    </div>
  );
}
