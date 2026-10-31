
import { useEffect, useState } from "react";

import {
  Download,
  FileCheck2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  LoaderCircle,
  AlertTriangle,
} from "lucide-react";

import {
  getDinov2Cases,
  getDinov2Verification,
} from "../services/api";

import type {
  Dinov2CasesResponse,
  Dinov2VerificationResult,
} from "../services/api";

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function displayName(value: string) {
  return value.replaceAll("_", " ");
}

export default function Reports() {
  const [verification, setVerification] =
    useState<Dinov2VerificationResult | null>(null);

  const [cases, setCases] =
    useState<Dinov2CasesResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      getDinov2Verification(),
      getDinov2Cases(),
    ])
      .then(([gate, inspectionCases]) => {
        if (!active) return;

        setVerification(gate);
        setCases(inspectionCases);
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err instanceof Error ? err.message : String(err)
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function downloadReport() {
    if (!verification || !cases) return;

    const exportData = {
      project: "FaultForge",
      model: "Meta DINOv2 ViT-S/14",
      evaluation_type: "exploratory",
      dataset: "MVTec AD Bottle",
      independent_validation: false,
      production_approved: false,
      note: "Dataset previously examined during development. Independent validation and dataset-use clearance are not established.",
      inspection: {
        model: cases.model,
        total_cases: cases.total_cases,
        total_failures: cases.total_failures,
        metrics: cases.metrics,
        cases: cases.cases,
      },
      verification,
    };

    const blob = new Blob(
      [JSON.stringify(exportData, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "faultforge_dinov2_report.json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-8 text-slate-300">
        <LoaderCircle
          size={20}
          className="animate-spin text-violet-400"
        />
        Loading DINOv2 verification report...
      </div>
    );
  }

  if (!verification || !cases) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6">
        <h2 className="font-semibold text-rose-300">
          Reports Unavailable
        </h2>

        <p className="mt-2 text-sm text-slate-300">
          {error || "DINOv2 results could not be loaded."}
        </p>
      </div>
    );
  }

  const baseline = verification.baseline;
  const candidate = verification.candidate_metrics;

  const metrics = [
    {
      label: "Accuracy",
      baseline: percent(baseline.accuracy),
      candidate: percent(candidate.accuracy),
    },
    {
      label: "Precision",
      baseline: percent(baseline.precision),
      candidate: percent(candidate.precision),
    },
    {
      label: "Defect Recall",
      baseline: percent(baseline.recall),
      candidate: percent(candidate.recall),
    },
    {
      label: "False Alarm Rate",
      baseline: percent(baseline.false_alarm_rate),
      candidate: percent(candidate.false_alarm_rate),
    },
    {
      label: "False Negatives",
      baseline: String(baseline.fn),
      candidate: String(candidate.fn),
    },
    {
      label: "False Positives",
      baseline: String(baseline.fp),
      candidate: String(candidate.fp),
    },
  ];

  const rejected = verification.decision.includes("REJECT");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-violet-400">
            META DINOv2 VERIFICATION EVIDENCE
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Reports
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Baseline and Blue Agent strategy comparison
            across {verification.samples_evaluated} images.
          </p>
        </div>

        <button
          onClick={downloadReport}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          <Download size={17} />
          Export DINOv2 JSON
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-[#131c2c] p-5">
          <p className="text-xs text-slate-400">
            Images Evaluated
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {verification.samples_evaluated}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#131c2c] p-5">
          <p className="text-xs text-slate-400">
            DINOv2 Accuracy
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {percent(baseline.accuracy)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#131c2c] p-5">
          <p className="text-xs text-slate-400">
            Blue Agent Accuracy
          </p>

          <p className="mt-2 text-2xl font-bold text-indigo-400">
            {percent(candidate.accuracy)}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
        <div className="flex items-center gap-3">
          <FileCheck2
            size={21}
            className="text-violet-400"
          />

          <h2 className="text-lg font-semibold text-white">
            Performance Comparison
          </h2>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="pb-4 font-medium">
                  Metric
                </th>

                <th className="pb-4 font-medium">
                  DINOv2 Baseline
                </th>

                <th className="pb-4 font-medium">
                  Blue Agent
                </th>
              </tr>
            </thead>

            <tbody>
              {metrics.map((metric) => (
                <tr
                  key={metric.label}
                  className="border-b border-slate-800 last:border-0"
                >
                  <td className="py-4 text-slate-300">
                    {metric.label}
                  </td>

                  <td className="py-4 text-slate-400">
                    {metric.baseline}
                  </td>

                  <td className="py-4 font-semibold text-white">
                    {metric.candidate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck
            size={21}
            className={
              rejected
                ? "text-rose-400"
                : "text-emerald-400"
            }
          />

          <h2 className="text-lg font-semibold text-white">
            Verification Gate
          </h2>
        </div>

        <div
          className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${
            rejected
              ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-300"
          }`}
        >
          Decision: {displayName(verification.decision)}
        </div>

        <div className="mt-6 space-y-3">
          {Object.entries(verification.checks).map(
            ([name, passed]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-4 rounded-xl bg-slate-800/50 p-4"
              >
                <span className="text-sm text-slate-300">
                  {displayName(name)}
                </span>

                <span
                  className={`flex items-center gap-2 text-xs font-semibold ${
                    passed
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {passed ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <XCircle size={17} />
                  )}

                  {passed ? "PASS" : "FAIL"}
                </span>
              </div>
            )
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

        <div className="mt-6 border-t border-slate-800 pt-5 text-sm text-slate-400">
          <p>
            Independent validation:{" "}
            {verification.independent_validation
              ? "Yes"
              : "No"}
          </p>

          <p className="mt-2">
            Production approved:{" "}
            {verification.production_approved
              ? "Yes"
              : "No"}
          </p>
        </div>
      </section>

      {rejected && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm leading-6 text-rose-200">
          <AlertTriangle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <p>
            Blue Agent increased defect recall but also
            introduced new false alarms. The strategy
            failed the configured verification checks
            and has not been approved.
          </p>
        </div>
      )}
    </div>
  );
}
