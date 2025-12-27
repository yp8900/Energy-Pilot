import { Zap, Activity, AlertTriangle, Server } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { StatusIndicator } from "@/components/StatusIndicator";
import { MetricGauge } from "@/components/MetricGauge";
import { useDevices, useAnalyticsOverview, useAlerts } from "@/hooks/use-ems";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";

// Mock data for the chart until we have real historical data hooked up completely
const chartData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  power: Math.floor(Math.random() * 50) + 100,
  voltage: 230 + Math.random() * 5,
}));

function DeviceGridItem({ device }: { device: any }) {
  // Use latest reading hook here if needed, or pass from parent
  // For dashboard grid, we assume basic info is enough or mock current values
  const power = device.status === 'online' ? (Math.random() * 10 + 5).toFixed(1) : 0;
  
  return (
    <div className="bg-card border border-border/50 rounded-xl p-5 hover:border-primary/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-medium text-foreground">{device.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{device.type} • {device.location}</p>
        </div>
        <StatusIndicator status={device.status} />
      </div>
      
      <div className="space-y-4">
        <MetricGauge label="Load" value={Number(power)} max={20} unit="kW" color="primary" />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <span className="text-xs text-muted-foreground block">Voltage</span>
            <span className="font-mono text-sm font-medium">
              {device.status === 'online' ? '230.1' : '0.0'} <span className="text-xs text-muted-foreground">V</span>
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Current</span>
            <span className="font-mono text-sm font-medium">
              {device.status === 'online' ? '24.5' : '0.0'} <span className="text-xs text-muted-foreground">A</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: analytics } = useAnalyticsOverview();
  const { data: devices, isLoading: isLoadingDevices } = useDevices();
  const { data: alerts } = useAlerts('active');

  const activeAlertsCount = alerts?.length || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Plant Overview</h1>
        <p className="text-muted-foreground">Real-time monitoring of energy consumption and device status.</p>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Power"
          value={analytics?.totalConsumption.toFixed(1) || "0.0"}
          unit="kW"
          icon={<Zap className="h-5 w-5" />}
          trend={{ value: 2.5, isPositive: true }}
        />
        <StatsCard
          title="Active Alarms"
          value={activeAlertsCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          alert={activeAlertsCount > 0}
          className={activeAlertsCount > 0 ? "animate-pulse border-destructive" : ""}
        />
        <StatsCard
          title="Online Devices"
          value={analytics?.onlineDevices || 0}
          unit={`/ ${analytics?.totalDevices || 0}`}
          icon={<Server className="h-5 w-5" />}
        />
        <StatsCard
          title="Grid Frequency"
          value="50.02"
          unit="Hz"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg">Power Consumption Trend</h3>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded font-medium">Live</span>
              <span className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded font-medium">24h</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value} kW`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="power" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPower)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts Panel */}
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm overflow-hidden flex flex-col">
          <h3 className="font-semibold text-lg mb-4">Recent Alerts</h3>
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 max-h-[300px] scrollbar-thin">
            {alerts && alerts.length > 0 ? (
              alerts.map((alert) => (
                <div key={alert.id} className="p-3 rounded-lg bg-secondary/50 border-l-2 border-destructive flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {alert.deviceName} • {format(new Date(alert.timestamp!), 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm py-12">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                System Healthy
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Device Status Grid */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-lg">Device Status</h3>
          <button className="text-sm text-primary hover:text-primary/80 font-medium">View All</button>
        </div>
        
        {isLoadingDevices ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-48 bg-card animate-pulse rounded-xl border border-border/50"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {devices?.map((device) => (
              <DeviceGridItem key={device.id} device={device} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
