
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

import MetricCard from "../components/MetricCard";
import type { FaultForgeReport } from "../services/api";
import { toPercent } from "../services/api";

interface Props {
  report: FaultForgeReport;
}

export default function Dashboard({ report }: Props) {
  const {
    baseline,
    candidate,
    failure_analysis,
    verification
  } = report;

  const improvement =
    (candidate.defect_recall - baseline.defect_recall) * 100;

  const chartData = [
    {
      name: "Global",
      recall: +(baseline.defect_recall * 100).toFixed(2),
      falseAlarms: +(baseline.false_alarm_rate * 100).toFixed(2)
    },
    {
      name: "Patch-Based",
      recall: +(candidate.defect_recall * 100).toFixed(2),
      falseAlarms: +(candidate.false_alarm_rate * 100).toFixed(2)
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
          <Activity size={13} />
          INSPECTION OVERVIEW
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white">
          Reliability Dashboard
        </h1>

        <p className="mt-2 text-slate-400">
          {report.dataset} · Exploratory evaluation
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Baseline Recall"
          value={toPercent(baseline.defect_recall)}
          description="Global ResNet18"
          icon={<Activity size={20} />}
        />

        <MetricCard
          label="Candidate Recall"
          value={toPercent(candidate.defect_recall)}
          description="Patch-Based Inspector"
          icon={<ShieldCheck size={20} />}
          accent="green"
        />

        <MetricCard
          label="Recovered Defects"
          value={String(failure_analysis.recovered_defects.length)}
          description="Previously missed defects detected"
          icon={<CheckCircle2 size={20} />}
          accent="blue"
        />

        <MetricCard
          label="Remaining Misses"
          value={String(candidate.missed_defects)}
          description="Defects still not detected"
          icon={<AlertTriangle size={20} />}
          accent="red"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Model Performance
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Recall and false alarm rate (%)
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              <ArrowUpRight size={16} />
              {improvement >= 0 ? "+" : ""}
              {improvement.toFixed(2)} pp recall
            </div>
          </div>

          <div className="mt-7 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  stroke="#273449"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 10
                  }}
                />
                <Legend />
                <Bar
                  dataKey="recall"
                  name="Recall (%)"
                  fill="#9585ff"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="falseAlarms"
                  name="False alarms (%)"
                  fill="#fb7185"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
          <h2 className="text-lg font-semibold text-white">
            Verification Gate
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Automated regression checks
          </p>

          <div className={`mt-5 rounded-xl border p-3 text-sm font-semibold ${
            verification.decision === "PROMISING_CANDIDATE"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-rose-500/20 bg-rose-500/10 text-rose-400"
          }`}>
            {verification.decision}
          </div>

          <div className="mt-6 space-y-4">
            {Object.entries(verification.checks).map(
              ([check, passed]) => (
                <div key={check} className="flex items-center gap-3">
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
                  <span className="text-sm text-slate-300">
                    {check.replaceAll("_", " ")}
                  </span>
                </div>
              )
            )}
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4 text-xs leading-6 text-slate-500">
            Independent validation: No
            <br />
            Production approved: No
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
          <h2 className="font-semibold text-white">
            Recovered Defects
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Missed by Global, detected by Patch-Based
          </p>

          <div className="mt-5 space-y-2">
            {failure_analysis.recovered_defects.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-3 text-sm"
              >
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="break-all text-slate-300">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
          <h2 className="font-semibold text-white">
            Remaining Failures
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Defects requiring further investigation
          </p>

          <div className="mt-5 space-y-2">
            {[
              ...failure_analysis.still_missed_defects,
              ...failure_analysis.new_missed_defects
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-3 text-sm"
              >
                <AlertTriangle size={16} className="text-rose-400" />
                <span className="break-all text-slate-300">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
