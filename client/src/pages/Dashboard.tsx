import { Zap, Activity, AlertTriangle, Server, Calendar, Clock } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { StatusIndicator } from "@/components/StatusIndicator";
import { MetricGauge } from "@/components/MetricGauge";
import { useDevices, useAnalyticsOverview, useAlerts } from "@/hooks/use-ems";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type Reading } from "@shared/schema";

function DeviceGridItem({ device, reading }: { device: any; reading?: Reading }) {
  // Use real BACnet data from reading
  const power = reading?.power || 0;
  const voltage = reading?.voltage || 0;
  const current = reading?.current || 0;
  const isOffline = device.status !== 'online';
  // Check if we have meaningful data - need at least 2 valid parameters
  const validParams = [
    reading?.power && reading.power > 0,
    reading?.voltage && reading.voltage > 0,
    reading?.current && reading.current > 0,
    reading?.frequency && reading.frequency > 0
  ].filter(Boolean).length;
  const hasData = reading && validParams >= 2;
  
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
        <MetricGauge 
          label="Load" 
          value={isOffline || !hasData ? 0 : power} 
          max={100} 
          unit="kW" 
          color="primary" 
        />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <span className="text-xs text-muted-foreground block">Voltage</span>
            <span className={`font-mono text-sm font-medium ${!hasData ? 'text-red-500' : ''}`}>
              {!hasData ? 'N/A' : isOffline ? '0.0' : voltage.toFixed(1)} {hasData && <span className="text-xs text-muted-foreground">V</span>}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Current</span>
            <span className={`font-mono text-sm font-medium ${!hasData ? 'text-red-500' : ''}`}>
              {!hasData ? 'N/A' : isOffline ? '0.0' : current.toFixed(1)} {hasData && <span className="text-xs text-muted-foreground">A</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const { data: analytics } = useAnalyticsOverview();
  const { data: devices, isLoading: isLoadingDevices } = useDevices();
  const { data: alerts } = useAlerts('active');

  const activeAlertsCount = alerts?.length || 0;

  // Fetch current readings for all devices
  const { data: deviceReadings } = useQuery({
    queryKey: ["device-readings"],
    queryFn: async () => {
      if (!devices || devices.length === 0) return {};
      
      const readingsMap: Record<number, Reading> = {};
      await Promise.all(
        devices.map(async (device) => {
          try {
            const res = await fetch(`/api/meters/${device.id}/reading`);
            if (res.ok) {
              const reading = await res.json() as Reading;
              readingsMap[device.id] = reading;
            }
          } catch (error) {
            console.error(`Failed to fetch reading for device ${device.id}:`, error);
          }
        })
      );
      return readingsMap;
    },
    enabled: !!devices && devices.length > 0,
    refetchInterval: 2000, // Real-time updates every 2 seconds
  });

  // Fetch period-specific analytics
  const { data: periodData } = useQuery({
    queryKey: ["analytics-period", selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/periods?period=${selectedPeriod}`);
      if (!res.ok) throw new Error("Failed to fetch period analytics");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Fetch 24-hour power consumption trend data
  const { data: trendData } = useQuery({
    queryKey: ["power-trend"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/power-trend?hours=24");
      if (!res.ok) throw new Error("Failed to fetch power trend");
      return res.json();
    },
    refetchInterval: 10000, // Update every 10 seconds
  });

  const chartData = trendData || [];

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case "today": return "Today's";
      case "week": return "This Week's";
      case "month": return "This Month's";
      default: return "Current";
    }
  };

  const getTimeLabel = () => {
    switch (selectedPeriod) {
      case "today": return `${periodData?.hours?.toFixed(1) || 0} hours elapsed`;
      case "week": return `${((periodData?.hours || 0) / 24).toFixed(1)} days elapsed`;
      case "month": return `${((periodData?.hours || 0) / 24).toFixed(1)} days elapsed`;
      default: return "";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Plant Overview</h1>
          <p className="text-muted-foreground">Real-time monitoring of energy consumption and device status.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title={`${getPeriodLabel()} Consumption`}
          value={periodData?.consumption?.toFixed(1) || "0.0"}
          unit="kWh"
          icon={<Zap className="h-5 w-5" />}
          description={getTimeLabel()}
          trend={periodData?.trend || undefined}
        />
        <StatsCard
          title={`${getPeriodLabel()} Cost`}
          value={`₹${(periodData?.cost?.toFixed(0) || "0")}`}
          unit="INR"
          icon={<Clock className="h-5 w-5" />}
          description={`@ ₹8/kWh rate`}
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
          description={periodData?.devicesWithData ? `${periodData.devicesWithData} with valid data` : undefined}
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
              <DeviceGridItem 
                key={device.id} 
                device={device} 
                reading={deviceReadings?.[device.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
