import { useState } from "react";
import { AlertTriangle, CheckCircle, Filter } from "lucide-react";
import { useAlerts, useAcknowledgeAlert } from "@/hooks/use-ems";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Alarms() {
  const [filter, setFilter] = useState<'active' | 'acknowledged' | 'all'>('active');
  const { data: alerts, isLoading } = useAlerts(filter);
  const { mutate: acknowledge, isPending } = useAcknowledgeAlert();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Alarms</h1>
          <p className="text-muted-foreground">Monitor and acknowledge system alerts and warnings.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border/50 pb-4">
        <button
          onClick={() => setFilter('active')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            filter === 'active' 
              ? "bg-destructive/10 text-destructive shadow-sm" 
              : "text-muted-foreground hover:bg-secondary"
          )}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('acknowledged')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            filter === 'acknowledged' 
              ? "bg-primary/10 text-primary shadow-sm" 
              : "text-muted-foreground hover:bg-secondary"
          )}
        >
          History
        </button>
        <button
          onClick={() => setFilter('all')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            filter === 'all' 
              ? "bg-secondary text-foreground shadow-sm" 
              : "text-muted-foreground hover:bg-secondary"
          )}
        >
          All
        </button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
           <div className="text-center py-12 text-muted-foreground">Loading alarms...</div>
        ) : alerts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border border-border/50 border-dashed">
            <CheckCircle className="h-12 w-12 text-primary/50 mb-3" />
            <h3 className="text-lg font-medium">No alerts found</h3>
            <p className="text-muted-foreground text-sm">Everything is running smoothly.</p>
          </div>
        ) : (
          alerts?.map((alert) => (
            <div 
              key={alert.id} 
              className={cn(
                "group relative bg-card p-6 rounded-xl border shadow-sm transition-all hover:shadow-md",
                alert.acknowledged 
                  ? "border-border/50 opacity-75" 
                  : "border-l-4 border-l-destructive border-t-border/50 border-r-border/50 border-b-border/50 pl-5"
              )}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className={cn(
                    "mt-1 p-2 rounded-lg",
                    alert.severity === 'critical' ? "bg-destructive/10 text-destructive" :
                    alert.severity === 'warning' ? "bg-yellow-500/10 text-yellow-500" :
                    "bg-blue-500/10 text-blue-500"
                  )}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{alert.message}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Device: <span className="text-foreground font-medium">{alert.deviceName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      {alert.timestamp ? format(new Date(alert.timestamp), "MMM dd, yyyy HH:mm:ss") : "-"}
                    </p>
                  </div>
                </div>

                {!alert.acknowledged && (
                  <Button 
                    onClick={() => acknowledge(alert.id)}
                    disabled={isPending}
                    variant="outline"
                    className="border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive text-destructive"
                  >
                    Acknowledge
                  </Button>
                )}
                {alert.acknowledged && (
                  <div className="flex items-center text-primary text-sm font-medium bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Acknowledged
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
