
import {
  Download,
  FileCheck2,
  CheckCircle2,
  XCircle,
  ShieldCheck
} from "lucide-react";

import type { FaultForgeReport } from "../services/api";
import { toPercent } from "../services/api";

interface Props {
  report: FaultForgeReport;
}

export default function Reports({ report }: Props) {
  const { baseline, candidate, verification } = report;

  const metrics = [
    {
      label: "Defect Recall",
      baseline: toPercent(baseline.defect_recall),
      candidate: toPercent(candidate.defect_recall)
    },
    {
      label: "False Alarm Rate",
      baseline: toPercent(baseline.false_alarm_rate),
      candidate: toPercent(candidate.false_alarm_rate)
    },
    {
      label: "ROC-AUC",
      baseline: baseline.roc_auc.toFixed(4),
      candidate: candidate.roc_auc.toFixed(4)
    },
    {
      label: "Missed Defects",
      baseline: String(baseline.missed_defects),
      candidate: String(candidate.missed_defects)
    },
    {
      label: "False Alarms",
      baseline: String(baseline.false_alarms),
      candidate: String(candidate.false_alarms)
    }
  ];

  function downloadReport() {
    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "faultforge_report.json";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-wider text-violet-400">
            VERIFICATION EVIDENCE
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Reports
          </h1>
          <p className="mt-2 text-slate-400">
            Model comparison and verification results.
          </p>
        </div>

        <button
          onClick={downloadReport}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          <Download size={17} />
          Export JSON
        </button>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
        <div className="flex items-center gap-3">
          <FileCheck2 size={21} className="text-violet-400" />
          <h2 className="text-lg font-semibold text-white">
            Performance Comparison
          </h2>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="pb-4 font-medium">Metric</th>
                <th className="pb-4 font-medium">Baseline</th>
                <th className="pb-4 font-medium">Candidate</th>
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
          <ShieldCheck size={21} className="text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">
            Verification Checks
          </h2>
        </div>

        <div className="mt-6 space-y-3">
          {Object.entries(verification.checks).map(([name, passed]) => (
            <div
              key={name}
              className="flex items-center justify-between gap-4 rounded-xl bg-slate-800/50 p-4"
            >
              <span className="text-sm text-slate-300">
                {name.replaceAll("_", " ")}
              </span>

              <span className={`flex items-center gap-2 text-xs font-semibold ${
                passed ? "text-emerald-400" : "text-rose-400"
              }`}>
                {passed ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <XCircle size={17} />
                )}
                {passed ? "PASS" : "FAIL"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-slate-800 pt-5">
          <p className="font-semibold text-white">
            Decision: {verification.decision}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Independent validation:{" "}
            {verification.independent_validation ? "Yes" : "No"}
            <br />
            Production approved:{" "}
            {verification.production_approved ? "Yes" : "No"}
          </p>
        </div>
      </section>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
        These results are exploratory. The test dataset has already
        been examined during development. Independent evaluation
        is required before claiming verified improvements.
      </div>
    </div>
  );
}
