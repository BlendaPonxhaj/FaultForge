
import { useEffect, useState } from "react";

import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import MetricCard from "../components/MetricCard";

import {
  getDinov2Verification,
  getDinov2Cases,
} from "../services/api";

import type {
  Dinov2VerificationResult,
  Dinov2CasesResponse,
} from "../services/api";

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function displayName(value: string): string {
  return value.replaceAll("_", " ");
}

export default function Dashboard() {
  const [verification, setVerification] =
    useState<Dinov2VerificationResult | null>(null);

  const [casesData, setCasesData] =
    useState<Dinov2CasesResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      getDinov2Verification(),
      getDinov2Cases(),
    ])
      .then(([gate, cases]) => {
        if (!active) return;
        setVerification(gate);
        setCasesData(cases);
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

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-8 text-slate-300">
        <LoaderCircle
          size={20}
          className="animate-spin text-violet-400"
        />
        Loading Meta DINOv2 dashboard...
      </div>
    );
  }

  if (!verification || !casesData) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6">
        <h2 className="font-semibold text-rose-300">
          DINOv2 Dashboard Unavailable
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {error || "The required reports are unavailable."}
        </p>
      </div>
    );
  }

  const baseline = verification.baseline;
  const candidate = verification.candidate_metrics;

  const chartData = [
    {
      name: "Baseline",
      recall: +(baseline.recall * 100).toFixed(2),
      falseAlarms: +(baseline.false_alarm_rate * 100).toFixed(2),
    },
    {
      name: "Blue Agent",
      recall: +(candidate.recall * 100).toFixed(2),
      falseAlarms: +(candidate.false_alarm_rate * 100).toFixed(2),
    },
  ];

  const decisionRejected =
    verification.decision.includes("REJECT");

  const missedCases = casesData.cases.filter(
    (item) => item.status === "missed"
  );

  const falseAlarmCases = casesData.cases.filter(
    (item) => item.status === "false_alarm"
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
          <Activity size={13} />
          META DINOv2 INSPECTION
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white">
          Reliability Dashboard
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Meta DINOv2 ViT-S/14 · Experimental anomaly detection
        </p>

        <p className="mt-1 text-xs text-amber-300">
          Exploratory evaluation — not independent validation
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="DINOv2 Accuracy"
          value={percent(baseline.accuracy)}
          description="Global embedding baseline"
          icon={<Activity size={20} />}
        />

        <MetricCard
          label="Blue Agent Accuracy"
          value={percent(candidate.accuracy)}
          description="Experimental majority voting"
          icon={<ShieldCheck size={20} />}
          accent="green"
        />

        <MetricCard
          label="Detected Defects"
          value={String(baseline.tp)}
          description="Correct baseline detections"
          icon={<CheckCircle2 size={20} />}
          accent="blue"
        />

        <MetricCard
          label="Missed Defects"
          value={String(baseline.fn)}
          description="Baseline false negatives"
          icon={<AlertTriangle size={20} />}
          accent="red"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6 xl:col-span-2">
          <h2 className="text-lg font-semibold text-white">
            Model Performance
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            DINOv2 baseline vs. experimental Blue Agent (%)
          </p>

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
                    borderRadius: 10,
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
                  name="False Alarm Rate (%)"
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
            DINOv2 strategy regression checks
          </p>

          <div
            className={`mt-5 rounded-xl border p-3 text-sm font-semibold ${
              decisionRejected
                ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                : "border-amber-500/20 bg-amber-500/10 text-amber-300"
            }`}
          >
            {displayName(verification.decision)}
          </div>

          <div className="mt-6 space-y-4">
            {Object.entries(verification.checks).map(
              ([check, passed]) => (
                <div
                  key={check}
                  className="flex items-start gap-3"
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

                  <span className="text-sm text-slate-300">
                    {displayName(check)}
                  </span>
                </div>
              )
            )}
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4 text-xs leading-6 text-slate-500">
            <p>
              Images evaluated: {verification.samples_evaluated}
            </p>
            <p>
              Independent validation:{" "}
              {verification.independent_validation
                ? "Yes"
                : "No"}
            </p>
            <p>
              Production approved:{" "}
              {verification.production_approved
                ? "Yes"
                : "No"}
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
          <h2 className="font-semibold text-white">
            Missed Defects
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Defective images not detected by DINOv2 baseline
          </p>

          <div className="mt-5 space-y-2">
            {missedCases.map((item) => (
              <div
                key={item.sample_id}
                className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-3 text-sm"
              >
                <AlertTriangle
                  size={16}
                  className="shrink-0 text-rose-400"
                />

                <span className="break-all text-slate-300">
                  {item.sample_id}
                </span>
              </div>
            ))}

            {missedCases.length === 0 && (
              <p className="text-sm text-slate-400">
                No missed defects in the loaded report.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
          <h2 className="font-semibold text-white">
            False Alarms
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Normal images incorrectly flagged by DINOv2 baseline
          </p>

          <div className="mt-5 space-y-2">
            {falseAlarmCases.map((item) => (
              <div
                key={item.sample_id}
                className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-3 text-sm"
              >
                <AlertTriangle
                  size={16}
                  className="shrink-0 text-amber-400"
                />

                <span className="break-all text-slate-300">
                  {item.sample_id}
                </span>
              </div>
            ))}

            {falseAlarmCases.length === 0 && (
              <p className="text-sm text-slate-400">
                No false alarms in the loaded report.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
