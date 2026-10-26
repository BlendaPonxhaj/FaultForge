
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  icon: ReactNode;
  accent?: "purple" | "green" | "red" | "blue";
}

const colors = {
  purple: "text-violet-400 bg-violet-500/10",
  green: "text-emerald-400 bg-emerald-500/10",
  red: "text-rose-400 bg-rose-500/10",
  blue: "text-sky-400 bg-sky-500/10"
};

export default function MetricCard({
  label,
  value,
  description,
  icon,
  accent = "purple"
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#131c2c] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-400">
          {label}
        </span>

        <div
          className={`rounded-xl p-2.5 ${colors[accent]}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-5 text-3xl font-bold tracking-tight text-white">
        {value}
      </div>

      {description && (
        <p className="mt-2 text-xs text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}
