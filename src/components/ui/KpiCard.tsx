import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { fadeSlideUp, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  trend,
  index = 0,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  trend?: { value: string; direction: "up" | "down" };
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("kpi-card", className)}
      variants={fadeSlideUp}
      initial="initial"
      animate="animate"
      transition={{ ...stagger(index, 0.055) }}
      whileHover={{ y: -2 }}
    >
      <div className="kpi-top">
        <div className="kpi-label">{label}</div>
        <div className="kpi-icon">{icon}</div>
      </div>
      <div className="kpi-value numeric">{value}</div>
      {(hint || trend) && (
        <div className="kpi-meta">
          {trend && (
            <span className={cn("kpi-delta", trend.direction)}>
              {trend.direction === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend.value}
            </span>
          )}
          {hint}
        </div>
      )}
    </motion.div>
  );
}
