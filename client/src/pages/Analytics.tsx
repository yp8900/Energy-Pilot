import { useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const dummyDailyData = Array.from({ length: 7 }, (_, i) => ({
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  usage: Math.floor(Math.random() * 500) + 1200,
  peak: Math.floor(Math.random() * 50) + 150,
}));

const dummyVoltageData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  phase1: 230 + Math.random() * 5 - 2.5,
  phase2: 230 + Math.random() * 5 - 2.5,
  phase3: 230 + Math.random() * 5 - 2.5,
}));

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("7d");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Historical analysis of energy patterns and power quality.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-card border border-border/50 rounded-lg p-1 flex">
            {['24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  timeRange === range ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Chart */}
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Energy Consumption (kWh)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dummyDailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--secondary))' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} 
                />
                <Bar dataKey="usage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Voltage Quality Chart */}
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-yellow-500" />
            Voltage Stability (V)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dummyVoltageData}>
                <defs>
                  <linearGradient id="colorP1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={[220, 240]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                <Legend />
                <Area type="monotone" dataKey="phase1" stroke="#ef4444" fillOpacity={1} fill="url(#colorP1)" name="Phase L1" />
                <Area type="monotone" dataKey="phase2" stroke="#f59e0b" fillOpacity={0} name="Phase L2" />
                <Area type="monotone" dataKey="phase3" stroke="#3b82f6" fillOpacity={0} name="Phase L3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-1">Peak Demand</p>
          <p className="text-3xl font-bold font-mono">184.2 <span className="text-sm text-muted-foreground font-sans">kW</span></p>
          <p className="text-xs text-muted-foreground mt-2">Recorded at 14:30 Today</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-1">Power Factor (Avg)</p>
          <p className="text-3xl font-bold font-mono">0.96</p>
          <p className="text-xs text-primary mt-2">Optimal Efficiency</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-1">Est. Cost (Today)</p>
          <p className="text-3xl font-bold font-mono">$428.50</p>
          <p className="text-xs text-muted-foreground mt-2">Based on $0.15/kWh</p>
        </div>
      </div>
    </div>
  );
}
