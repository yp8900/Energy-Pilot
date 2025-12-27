import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "maintenance" | "warning" | "critical" | string;

export function StatusIndicator({ status, pulse = true }: { status: Status; pulse?: boolean }) {
  const getColors = (s: string) => {
    switch (s.toLowerCase()) {
      case "online":
      case "normal":
        return "bg-primary text-primary-foreground shadow-primary/50";
      case "warning":
        return "bg-yellow-500 text-black shadow-yellow-500/50";
      case "critical":
      case "alarm":
        return "bg-destructive text-destructive-foreground shadow-destructive/50";
      case "offline":
        return "bg-muted-foreground/30 text-muted-foreground shadow-none";
      case "maintenance":
        return "bg-blue-500 text-white shadow-blue-500/50";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const colors = getColors(status);
  const isHealthy = ["online", "normal"].includes(status.toLowerCase());
  const isAlarm = ["critical", "alarm", "warning"].includes(status.toLowerCase());

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-3 w-3">
        {(pulse && (isHealthy || isAlarm)) && (
          <span className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            colors.split(" ")[0] // Take just the bg color part
          )}></span>
        )}
        <span className={cn(
          "relative inline-flex rounded-full h-3 w-3",
          colors.split(" ")[0]
        )}></span>
      </div>
      <span className="text-sm capitalize font-medium text-muted-foreground">
        {status}
      </span>
    </div>
  );
}
