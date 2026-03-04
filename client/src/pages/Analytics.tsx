import { useState, useEffect } from "react";
import { BarChart3, Download, TrendingUp, Zap, PieChart, Activity, IndianRupee, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line, Pie, Cell } from 'recharts';
import { BMSIntegration } from "@/components/BMSIntegration";
import { ExportDialog, type ExportOptions } from "@/components/ExportDialog";
import { useQuery } from "@tanstack/react-query";
import { useDevices } from "@/hooks/use-ems";

// No more dummy data - all data must come from real sources

// Function removed - no longer generating fake voltage data
function generateVoltageData(hours: number, deviceId?: number, deviceType?: string) {
  // Return empty array - only show real data from database
  return [];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

// Helper function to process device breakdown from consumption data
function processDeviceBreakdown(data: any) {
  if (!data || !Array.isArray(data)) {
    // No dummy data - return empty array if no real data
    return [];
  }
  
  // Group consumption by device across all time periods
  const deviceTotals = data.reduce((acc: any, item: any) => {
    const deviceName = item.deviceName || `Device ${item.deviceId}`;
    if (!acc[deviceName]) {
      acc[deviceName] = 0;
    }
    acc[deviceName] += item.energy || 0;
    return acc;
  }, {});
  
  // Convert to array and calculate percentages
  const deviceArray = Object.entries(deviceTotals).map(([name, value]: [string, any]) => ({
    name,
    value: Math.round(value * 100) / 100
  }));
  
  const total = deviceArray.reduce((sum, device) => sum + device.value, 0);
  
  return deviceArray.map(device => ({
    ...device,
    percentage: Math.round((device.value / total) * 100)
  })).sort((a, b) => b.value - a.value);
}
function processConsumptionData(data: any, tariffRate: number) {
  if (!data || !Array.isArray(data)) {
    // No dummy data - return empty array
    return [];
  }
  
  // Group data by date and aggregate energy consumption
  const groupedData = data.reduce((acc: any, item: any) => {
    const date = item.date;
    if (!acc[date]) {
      acc[date] = {
        date,
        day: new Date(date).toLocaleDateString('en', { weekday: 'short' }),
        usage: 0,
        cost: 0
      };
    }
    
    acc[date].usage += item.energy || 0;
    return acc;
  }, {});
  
  // Convert to array and calculate costs
  return Object.values(groupedData).map((item: any) => ({
    ...item,
    cost: item.usage * tariffRate
  })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [voltageTimeRange, setVoltageTimeRange] = useState(24); // Default 24 hours
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [tariffRate, setTariffRate] = useState(8); // Default ₹8 per kWh

  // Fetch devices data
  const { data: devices } = useDevices();

  // Set default device when devices are loaded
  useEffect(() => {
    if (devices && devices.length > 0 && selectedDeviceId === null) {
      const smartMeters = devices.filter(device => device.type === 'smart_meter' || device.type === 'Smart Meter');
      if (smartMeters.length > 0) {
        setSelectedDeviceId(smartMeters[0].id);
      }
    }
  }, [devices, selectedDeviceId]);

  // Fetch period-specific analytics for Summary Statistics
  const { data: periodData } = useQuery({
    queryKey: ["analytics-period", selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/periods?period=${selectedPeriod}`);
      if (!res.ok) throw new Error("Failed to fetch period analytics");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Fetch enhanced analytics for Summary Statistics
  const { data: enhancedData } = useQuery({
    queryKey: ["enhanced-analytics"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/summary`);
      if (!res.ok) throw new Error("Failed to fetch enhanced analytics");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Fetch consumption data for charts
  const { data: consumptionData, isLoading: consumptionLoading } = useQuery({
    queryKey: ['consumption', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/consumption?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch consumption data');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch cost trends data
  const { data: costTrendsData } = useQuery({
    queryKey: ['cost-trends', timeRange, tariffRate],
    queryFn: async () => {
      const days = timeRange === '24h' ? '1' : timeRange === '7d' ? '7' : '30';
      const response = await fetch(`/api/analytics/cost-trends?days=${days}&tariffRate=${tariffRate}`);
      if (!response.ok) throw new Error('Failed to fetch cost trends');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch voltage stability data
  const { data: voltageData } = useQuery({
    queryKey: ['voltage-stability', selectedDeviceId, voltageTimeRange],
    queryFn: async () => {
      const deviceParam = selectedDeviceId ? `deviceId=${selectedDeviceId}` : '';
      const params = deviceParam ? `${deviceParam}&hours=${voltageTimeRange}` : `hours=${voltageTimeRange}`;
      const response = await fetch(`/api/analytics/voltage-stability?${params}`);
      if (!response.ok) throw new Error('Failed to fetch voltage data');
      return response.json();
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch current stability data (3-phase currents)
  const { data: currentData } = useQuery({
    queryKey: ['current-stability', selectedDeviceId, voltageTimeRange],
    queryFn: async () => {
      const deviceParam = selectedDeviceId ? `deviceId=${selectedDeviceId}` : '';
      const params = deviceParam ? `${deviceParam}&hours=${voltageTimeRange}` : `hours=${voltageTimeRange}`;
      const response = await fetch(`/api/analytics/current-stability?${params}`);
      if (!response.ok) throw new Error('Failed to fetch current data');
      return response.json();
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Process data for charts
  const chartData = costTrendsData && costTrendsData.length > 0 
    ? costTrendsData 
    : processConsumptionData(null, tariffRate);
  
  // Calculate summary statistics from real data
  const totalConsumption = chartData.reduce((sum: number, item: any) => sum + (item.usage || 0), 0);
  const totalCost = chartData.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
  
  // Process device breakdown from real consumption data
  const deviceBreakdown = processDeviceBreakdown(consumptionData);
  
  // Process voltage data for chart
  const voltageChartData = voltageData && voltageData.length > 0
    ? voltageData
    : generateVoltageData(voltageTimeRange, selectedDeviceId || undefined, selectedDeviceId ? devices?.find(d => d.id === selectedDeviceId)?.type : undefined);

  // Process current data for chart
  const currentChartData = currentData && currentData.length > 0
    ? currentData
    : [];

  // Calculate dynamic Y-axis domain based on actual voltage data
  const calculateVoltageDomain = () => {
    if (!voltageChartData || voltageChartData.length === 0) {
      return [0, 600]; // Default range for high voltage systems
    }
    
    const allVoltages = voltageChartData.flatMap((d: any) => [
      d.phase1 || 0,
      d.phase2 || 0,
      d.phase3 || 0
    ]).filter(v => v > 0);
    
    if (allVoltages.length === 0) return [0, 600];
    
    const minVoltage = Math.min(...allVoltages);
    const maxVoltage = Math.max(...allVoltages);
    
    // Use 0-600V range to accommodate high voltage readings
    // Add padding based on actual data range
    const padding = Math.max(20, (maxVoltage - minVoltage) * 0.1);
    const domainMin = Math.max(0, Math.floor(minVoltage - padding));
    const domainMax = Math.min(600, Math.ceil(maxVoltage + padding));
    
    return [domainMin, domainMax];
  };

  const voltageDomain = calculateVoltageDomain();

  // Custom tick formatter for time-based X-axis
  const formatXAxisTick = (value: string, index: number, data: any[]) => {
    if (!data || data.length === 0) return value;
    
    // For 12 hours: show every 2 hours
    if (voltageTimeRange <= 12) {
      return index % 2 === 0 ? value : '';
    }
    // For 24 hours: show every 3 hours
    else if (voltageTimeRange <= 24) {
      return index % 3 === 0 ? value : '';
    }
    // For 36-48 hours: show every 6 hours
    else if (voltageTimeRange <= 48) {
      return index % 6 === 0 ? value : '';
    }
    // For 3+ days: show with date
    else {
      // Show every 12 hours with date
      const item = data[index];
      return index % 12 === 0 && item?.fullTime ? item.fullTime : '';
    }
  };

  const handleExport = async (options: ExportOptions) => {
    try {
      console.log('🔄 Starting export with options:', options);
      
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Export failed:', errorText);
        throw new Error(`Export failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('📦 Export result:', { filename: result.filename, dataLength: result.data?.length });
      
      if (!result.data || !result.filename) {
        throw new Error('Invalid export response - missing data or filename');
      }
      
      // Create and download file
      const blob = new Blob([result.data], { 
        type: options.format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      console.log('💾 Blob created:', { size: blob.size, type: blob.type });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.style.display = 'none';
      document.body.appendChild(a); // Required for Firefox
      
      console.log('⬇️ Triggering download:', result.filename);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('✅ Export completed and cleaned up');
      }, 100);
      
      setExportDialogOpen(false);
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header with Export Button and Tariff Rate */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Energy Analytics</h1>
            <p className="text-muted-foreground">Track and analyze energy consumption patterns</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Tariff Rate Input */}
            <div className="flex items-center gap-2 min-w-[200px]">
              <Label htmlFor="tariff-rate" className="text-sm font-medium whitespace-nowrap">
                <IndianRupee className="h-4 w-4 inline mr-1" />
                Tariff Rate:
              </Label>
              <Input
                id="tariff-rate"
                type="number"
                step="0.01"
                min="0"
                value={tariffRate}
                onChange={(e) => setTariffRate(parseFloat(e.target.value) || 0)}
                className="w-20 text-center"
                placeholder="8.00"
              />
              <span className="text-sm text-muted-foreground">/kWh</span>
            </div>
            
            <Button
              onClick={() => setExportDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Data
            </Button>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Energy Consumption Chart */}
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Energy Consumption (kWh)
            {consumptionLoading && <div className="ml-2 text-xs text-muted-foreground">Loading...</div>}
          </h3>
          <div className="h-[300px]">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No consumption data available</p>
                  <p className="text-sm mt-1">Add devices to see real-time data</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--secondary))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    formatter={(value: any) => [`${typeof value === 'number' ? value.toFixed(1) : value} kWh`, 'Consumption']}
                  />
                  <Bar dataKey="usage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Cost Trends Chart */}
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Daily Cost Trends (₹)
          </h3>
          <div className="h-[300px]">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No cost data available</p>
                  <p className="text-sm mt-1">Add devices to see trends</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    formatter={(value: any) => [`₹${typeof value === 'number' ? value.toFixed(2) : value}`, 'Daily Cost']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Breakdown Chart */}
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-blue-500" />
            Consumption by Device
            {consumptionLoading && <div className="ml-2 text-xs text-muted-foreground">Loading...</div>}
          </h3>
          <div className="space-y-4">
            {deviceBreakdown.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No device breakdown available</p>
                  <p className="text-sm mt-1">Add devices to see consumption by device</p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deviceBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }: any) => `${percentage}%`}
                        outerRadius={90}
                        innerRadius={40}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {deviceBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any, name: string) => [`${value.toFixed(1)} kWh`, 'Consumption']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Device Legend */}
                <div className="grid grid-cols-1 gap-2">
                  {deviceBreakdown.map((device, index) => (
                    <div key={device.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-medium">{device.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{device.value.toFixed(1)} kWh</div>
                        <div className="text-xs text-muted-foreground">{device.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Building Performance
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Total Power</p>
              <p className="text-2xl font-bold text-blue-600">
                {enhancedData?.totalCurrentPower || "0.0"} kW
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Projected Monthly Cost</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{enhancedData?.projectedMonthlyCost || "0"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Peak Consumer</p>
              <div>
                <p className="text-lg font-bold text-orange-600">
                  {enhancedData?.peakDevice?.power || "0"} kW
                </p>
                <p className="text-xs text-muted-foreground">
                  {enhancedData?.peakDevice?.name || "None"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Avg Power/Device</p>
              <p className="text-2xl font-bold text-purple-600">
                {enhancedData?.avgPowerPerDevice || "0"} kW
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Voltage Quality Chart */}
      <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Voltage Stability
            {selectedDeviceId && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                - {devices?.find(d => d.id === selectedDeviceId)?.name || `Device ${selectedDeviceId}`}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="device-selector" className="text-sm text-muted-foreground">Meter:</Label>
              <select
                id="device-selector"
                value={selectedDeviceId || ''}
                onChange={(e) => setSelectedDeviceId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]"
              >
                {devices?.filter(device => device.type === 'smart_meter' || device.type === 'Smart Meter' || device.type === 'energy_meter').map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name} - {device.location}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="voltage-time-range" className="text-sm text-muted-foreground">Time Range:</Label>
              <select
                id="voltage-time-range"
                value={voltageTimeRange}
                onChange={(e) => setVoltageTimeRange(Number(e.target.value))}
                className="px-3 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value={12}>Past 12 Hours</option>
                <option value={24}>Past 24 Hours (Default)</option>
                <option value={36}>Past 36 Hours</option>
                <option value={48}>Past 48 Hours</option>
                <option value={72}>Past 3 Days</option>
                <option value={168}>Past Week</option>
              </select>
            </div>
          </div>
        </div>
        <div className="h-[350px]">
          {voltageChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No voltage data available</p>
                <p className="text-sm mt-1">
                  {selectedDeviceId 
                    ? "Waiting for voltage readings from the selected device" 
                    : "Select a meter to view voltage stability"}
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={voltageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey={voltageTimeRange > 48 ? "fullTime" : "time"}
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  angle={voltageTimeRange > 48 ? -45 : 0}
                  textAnchor={voltageTimeRange > 48 ? "end" : "middle"}
                  height={voltageTimeRange > 48 ? 70 : 30}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value, index) => formatXAxisTick(value, index, voltageChartData)}
                  interval="preserveStartEnd"
                  minTickGap={voltageTimeRange <= 12 ? 30 : voltageTimeRange <= 24 ? 40 : voltageTimeRange <= 48 ? 50 : 60}
                />
              <YAxis 
                domain={voltageDomain} 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                label={{ value: 'Voltage (V)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontSize: '12px' }}
                formatter={(value: any) => [`${Number(value).toFixed(1)} V`, '']}
                labelFormatter={(label) => {
                  // Find the data point to get fullTime
                  const dataPoint = voltageChartData.find((d: any) => d.time === label || d.fullTime === label);
                  if (dataPoint?.fullTime) {
                    return dataPoint.fullTime;
                  }
                  // For shorter ranges, add today's date
                  return `${new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}, ${label}`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="phase1" stroke="#ef4444" strokeWidth={2} dot={false} name="L1-L2 (V)" />
              <Line type="monotone" dataKey="phase2" stroke="#f59e0b" strokeWidth={2} dot={false} name="L2-L3 (V)" />
              <Line type="monotone" dataKey="phase3" stroke="#3b82f6" strokeWidth={2} dot={false} name="L3-L1 (V)" />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Current Stability Chart (3-Phase) */}
      <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Current Stability (3-Phase)
            {selectedDeviceId && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                - {devices?.find(d => d.id === selectedDeviceId)?.name || `Device ${selectedDeviceId}`}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="current-device-selector" className="text-sm text-muted-foreground">Meter:</Label>
              <select
                id="current-device-selector"
                value={selectedDeviceId || ''}
                onChange={(e) => setSelectedDeviceId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]"
              >
                {devices?.filter(device => device.type === 'smart_meter' || device.type === 'Smart Meter').map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name} - {device.location}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="current-time-range" className="text-sm text-muted-foreground">Time Range:</Label>
              <select
                id="current-time-range"
                value={voltageTimeRange}
                onChange={(e) => setVoltageTimeRange(Number(e.target.value))}
                className="px-3 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value={12}>Past 12 Hours</option>
                <option value={24}>Past 24 Hours (Default)</option>
                <option value={36}>Past 36 Hours</option>
                <option value={48}>Past 48 Hours</option>
                <option value={72}>Past 3 Days</option>
                <option value={168}>Past Week</option>
              </select>
            </div>
          </div>
        </div>
        <div className="h-[350px]">
          {currentChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No current data available</p>
                <p className="text-sm mt-1">
                  {selectedDeviceId 
                    ? "Waiting for current readings from the selected device" 
                    : "Select a meter to view current stability"}
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey={voltageTimeRange > 48 ? "fullTime" : "time"}
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  angle={voltageTimeRange > 48 ? -45 : 0}
                  textAnchor={voltageTimeRange > 48 ? "end" : "middle"}
                  height={voltageTimeRange > 48 ? 70 : 30}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value, index) => formatXAxisTick(value, index, currentChartData)}
                  interval="preserveStartEnd"
                  minTickGap={voltageTimeRange <= 12 ? 30 : voltageTimeRange <= 24 ? 40 : voltageTimeRange <= 48 ? 50 : 60}
                />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                label={{ value: 'Current (A)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontSize: '12px' }}
                formatter={(value: any) => [`${Number(value).toFixed(1)} A`, '']}
                labelFormatter={(label) => {
                  // Find the data point to get fullTime
                  const dataPoint = currentChartData.find((d: any) => d.time === label || d.fullTime === label);
                  if (dataPoint?.fullTime) {
                    return dataPoint.fullTime;
                  }
                  // For shorter ranges, add today's date
                  return `${new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}, ${label}`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="phase1" stroke="#10b981" strokeWidth={2} dot={false} name="L1 (A)" />
              <Line type="monotone" dataKey="phase2" stroke="#06b6d4" strokeWidth={2} dot={false} name="L2 (A)" />
              <Line type="monotone" dataKey="phase3" stroke="#8b5cf6" strokeWidth={2} dot={false} name="L3 (A)" />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* BMS Integration Section */}
      <BMSIntegration />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
