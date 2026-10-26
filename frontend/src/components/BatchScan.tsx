
import { useState } from "react";
import { Play, LoaderCircle, ShieldAlert } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

import { runBatchTest } from "../services/api";
import type { BatchReport } from "../services/api";

const names: Record<string, string> = {
  original: "Original",
  dark: "Dark",
  bright: "Bright",
  low_contrast: "Low Contrast",
  high_contrast: "High Contrast"
};

export default function BatchScan() {
  const [report, setReport] = useState<BatchReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function handleRun() {
    if (running) return;

    setRunning(true);
    setError("");
    setReport(null);

    try {
      const result = await runBatchTest();
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const rows = report
    ? Object.entries(report.conditions).map(([key, value]) => ({
        condition: names[key] ?? key,
        recall: +(value.defect_recall * 100).toFixed(2),
        falseAlarms: +(value.false_alarm_rate * 100).toFixed(2),
        missed: value.false_negatives,
        alarms: value.false_positives,
        total: value.total_images
      }))
    : [];

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-[#131c2c] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={21} className="text-violet-400" />
            <h2 className="text-xl font-semibold text-white">
              Full Reliability Scan
            </h2>
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Test all 83 inspection images across five visual conditions.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {running ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <Play size={18} />
          )}
          {running ? "Scanning..." : "Run Full Reliability Scan"}
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </p>
      )}

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Images</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {rows[0]?.total ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Conditions</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {rows.length}
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Evaluations</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {rows.reduce((sum, row) => sum + row.total, 0)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white">
              Robustness Across Conditions
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Defect recall and false alarm rate (%)
            </p>

            <div className="mt-5 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                  <CartesianGrid stroke="#273449" vertical={false} />
                  <XAxis
                    dataKey="condition"
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 10
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="recall"
                    name="Recall (%)"
                    fill="#9585ff"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="falseAlarms"
                    name="False alarms (%)"
                    fill="#fb7185"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-3">Condition</th>
                  <th>Recall</th>
                  <th>False Alarms</th>
                  <th>Missed Defects</th>
                  <th>Alarm Count</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.condition}
                    className="border-b border-slate-800 text-slate-300"
                  >
                    <td className="py-4 font-medium text-white">
                      {row.condition}
                    </td>
                    <td>{row.recall.toFixed(2)}%</td>
                    <td>{row.falseAlarms.toFixed(2)}%</td>
                    <td>{row.missed}</td>
                    <td>{row.alarms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6 text-amber-200">
            These tests use synthetic image transformations.
            High recall alone does not imply improved reliability:
            false alarms must also remain controlled.
            Independent validation has not been performed.
          </div>
        </>
      )}
    </section>
  );
}
