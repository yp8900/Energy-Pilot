import { cn } from "@/lib/utils";

interface MetricGaugeProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  color?: "primary" | "warning" | "destructive" | "blue";
}

export function MetricGauge({ label, value, max, unit, color = "primary" }: MetricGaugeProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const getColorClass = (c: string) => {
    switch (c) {
      case "primary": return "bg-primary";
      case "warning": return "bg-yellow-500";
      case "destructive": return "bg-destructive";
      case "blue": return "bg-blue-500";
      default: return "bg-primary";
    }
  };

  const bgClass = getColorClass(color);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-end text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">
          {value.toFixed(1)} <span className="text-muted-foreground">{unit}</span>
        </span>
      </div>
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", bgClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
