import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  trend?: { value: number; isPositive: boolean };
  className?: string;
  alert?: boolean;
}

export function StatsCard({ title, value, unit, icon, trend, className, alert }: StatsCardProps) {
  return (
    <div className={cn(
      "glass-panel p-6 rounded-xl relative overflow-hidden group hover:bg-card/90 transition-all duration-300",
      alert && "border-destructive/50 bg-destructive/5",
      className
    )}>
      {/* Background Glow Effect */}
      <div className={cn(
        "absolute -right-6 -top-6 w-24 h-24 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity",
        alert ? "bg-destructive" : "bg-primary"
      )} />

      <div className="flex justify-between items-start mb-4">
        <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">{title}</p>
        {icon && <div className={cn("text-muted-foreground", alert && "text-destructive")}>{icon}</div>}
      </div>

      <div className="flex items-baseline gap-1">
        <h3 className={cn(
          "text-3xl font-bold font-mono tracking-tight glow-text",
          alert ? "text-destructive" : "text-foreground"
        )}>
          {value}
        </h3>
        {unit && <span className="text-sm text-muted-foreground font-medium ml-1">{unit}</span>}
      </div>

      {trend && (
        <div className="mt-4 flex items-center text-xs font-medium">
          <span className={cn(
            trend.isPositive ? "text-primary" : "text-destructive",
            "flex items-center"
          )}>
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground/60 ml-2">vs last hour</span>
        </div>
      )}
    </div>
  );
}
