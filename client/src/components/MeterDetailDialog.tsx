import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Activity, Gauge, Clock, TrendingUp } from "lucide-react";
import { type Device, type Reading, type BacnetObjectMapping } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface MeterDetailDialogProps {
  meter: Device;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeterDetailDialog({ meter, open, onOpenChange }: MeterDetailDialogProps) {
  const [timeRange, setTimeRange] = useState("24");

  // Fetch current reading
  const { data: currentReading, isLoading: loadingCurrent, error: readingError } = useQuery({
    queryKey: ["meter-reading", meter.id],
    queryFn: async () => {
      const res = await fetch(`/api/meters/${meter.id}/reading`);
      if (!res.ok) throw new Error("Failed to fetch meter reading");
      const data = await res.json();
      return data;
    },
    refetchInterval: open ? 2000 : false,
    enabled: open,
    retry: 2,
    staleTime: 1000,
  });

  // Fetch historical readings
  const { data: readings = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["meter-readings", meter.id, timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/meters/${meter.id}/readings?hours=${timeRange}`);
      if (!res.ok) throw new Error("Failed to fetch meter readings");
      return res.json();
    },
    refetchInterval: open ? 10000 : false,
    enabled: open,
    retry: 2,
    staleTime: 5000,
  });

  // Fetch BACnet parameters
  const { data: bacnetData, isLoading: loadingParameters } = useQuery({
    queryKey: ["bacnet-parameters", meter.id],
    queryFn: async () => {
      const res = await fetch(`/api/devices/${meter.id}/bacnet-parameters`);
      if (!res.ok) throw new Error("Failed to fetch BACnet parameters");
      const data = await res.json();
      return data as { success: boolean; deviceId: number; parameters: BacnetObjectMapping[] };
    },
    enabled: open,
    retry: 2,
  });

  const parameters = bacnetData?.parameters || [];

  // Fetch live parameter values
  // Fetch live parameter values from BACnet device
  const { data: parameterValues } = useQuery({
    queryKey: ["parameter-values", meter.id],
    queryFn: async () => {
      const res = await fetch(`/api/devices/${meter.id}/bacnet-parameters/values`);
      if (!res.ok) throw new Error("Failed to fetch parameter values");
      const data = await res.json();
      console.log('[Parameter Values] Fetched:', data);
      return data as { success: boolean; deviceId: number; parameters: Array<BacnetObjectMapping & { currentValue: number | null }> };
    },
    refetchInterval: open ? 5000 : false, // Refresh every 5 seconds when open
    enabled: open && parameters.length > 0,
    retry: 2,
  });

  // Debug logging
  console.log('[MeterDetailDialog] Parameters:', parameters);
  console.log('[MeterDetailDialog] Parameter Values:', parameterValues);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-red-500";
      case "maintenance":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      online: "bg-green-100 text-green-800",
      offline: "bg-red-100 text-red-800",
      maintenance: "bg-yellow-100 text-yellow-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const formatValue = (value: number | undefined | null, unit: string, decimals = 1, isOffline = false) => {
    if (value === undefined || value === null) return "- " + unit;
    if (isOffline && value === 0) return "Offline";
    return `${Number(value).toFixed(decimals)} ${unit}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const chartData = readings.map(reading => ({
    time: formatTimestamp(reading.timestamp),
    power: reading.power || 0,
    voltage: reading.voltage || 0,
    current: reading.current || 0,
    energy: reading.energy || 0,
  }));

  const averageValues = readings.length > 0 ? {
    power: readings.reduce((sum, r) => sum + (r.power || 0), 0) / readings.length,
    voltage: readings.reduce((sum, r) => sum + (r.voltage || 0), 0) / readings.length,
    current: readings.reduce((sum, r) => sum + (r.current || 0), 0) / readings.length,
    energy: readings[readings.length - 1]?.energy || 0,
  } : { power: 0, voltage: 0, current: 0, energy: 0 };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{meter.name}</DialogTitle>
              <p className="text-muted-foreground mt-1">
                {meter.location} • {meter.type.replace('_', ' ')} • {meter.ipAddress}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {currentReading?.timestamp ? new Date(currentReading.timestamp).toLocaleString() : "No data available"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(meter.status)}`} />
              <Badge className={getStatusBadge(meter.status)}>
                {meter.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="realtime" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="realtime">Real-time Data</TabsTrigger>
            <TabsTrigger value="trends">Trends & History</TabsTrigger>
            <TabsTrigger value="details">Device Details</TabsTrigger>
          </TabsList>

          <TabsContent value="realtime" className="space-y-3">
            {currentReading || parameters.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span>📊</span> Live Meter Readings
                  {currentReading?.timestamp && (
                    <span className="text-xs text-muted-foreground font-normal">
                      Last Updated: {new Date(currentReading.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </h3>
                
                {/* Direct Reading Parameters */}
                {currentReading && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {/* Power */}
                    {currentReading.power !== null && currentReading.power !== undefined && (
                      <Card className="border-l-4 border-blue-500 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">💡</span>
                            <CardTitle className="text-xs font-medium">Active Power</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.power.toFixed(2)}</p>
                            <span className="text-sm font-mono">kW</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Energy */}
                    {currentReading.energy !== null && currentReading.energy !== undefined && (
                      <Card className="border-l-4 border-green-500 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔋</span>
                            <CardTitle className="text-xs font-medium">Total Energy</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.energy.toFixed(1)}</p>
                            <span className="text-sm font-mono">kWh</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Voltage Average */}
                    {currentReading.voltage !== null && currentReading.voltage !== undefined && (
                      <Card className="border-l-4 border-yellow-500 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <CardTitle className="text-xs font-medium">Voltage (Avg)</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.voltage.toFixed(1)}</p>
                            <span className="text-sm font-mono">V</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Current Average */}
                    {currentReading.current !== null && currentReading.current !== undefined && (
                      <Card className="border-l-4 border-purple-500 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔌</span>
                            <CardTitle className="text-xs font-medium">Current (Avg)</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.current.toFixed(1)}</p>
                            <span className="text-sm font-mono">A</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Frequency */}
                    {currentReading.frequency !== null && currentReading.frequency !== undefined && (
                      <Card className="border-l-4 border-orange-500 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">〰️</span>
                            <CardTitle className="text-xs font-medium">Frequency</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.frequency.toFixed(2)}</p>
                            <span className="text-sm font-mono">Hz</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Power Factor */}
                    {currentReading.powerFactor !== null && currentReading.powerFactor !== undefined && (
                      <Card className="border-l-4 border-gray-400 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            <CardTitle className="text-xs font-medium">Power Factor</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.powerFactor.toFixed(3)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 3-Phase Voltages */}
                    {currentReading.voltageL1L2 !== null && currentReading.voltageL1L2 !== undefined && (
                      <Card className="border-l-4 border-yellow-600 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <CardTitle className="text-xs font-medium">Voltage L1-L2</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.voltageL1L2.toFixed(1)}</p>
                            <span className="text-sm font-mono">V</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {currentReading.voltageL2L3 !== null && currentReading.voltageL2L3 !== undefined && (
                      <Card className="border-l-4 border-yellow-600 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <CardTitle className="text-xs font-medium">Voltage L2-L3</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.voltageL2L3.toFixed(1)}</p>
                            <span className="text-sm font-mono">V</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {currentReading.voltageL3L1 !== null && currentReading.voltageL3L1 !== undefined && (
                      <Card className="border-l-4 border-yellow-600 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <CardTitle className="text-xs font-medium">Voltage L3-L1</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.voltageL3L1.toFixed(1)}</p>
                            <span className="text-sm font-mono">V</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 3-Phase Currents */}
                    {currentReading.currentL1 !== null && currentReading.currentL1 !== undefined && (
                      <Card className="border-l-4 border-purple-600 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔌</span>
                            <CardTitle className="text-xs font-medium">Current L1</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.currentL1.toFixed(1)}</p>
                            <span className="text-sm font-mono">A</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {currentReading.currentL2 !== null && currentReading.currentL2 !== undefined && (
                      <Card className="border-l-4 border-purple-600 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔌</span>
                            <CardTitle className="text-xs font-medium">Current L2</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.currentL2.toFixed(1)}</p>
                            <span className="text-sm font-mono">A</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {currentReading.currentL3 !== null && currentReading.currentL3 !== undefined && (
                      <Card className="border-l-4 border-purple-600 h-full">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔌</span>
                            <CardTitle className="text-xs font-medium">Current L3</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold">{currentReading.currentL3.toFixed(1)}</p>
                            <span className="text-sm font-mono">A</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* BACnet Parameters (if configured) */}
                {parameters.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 mt-6">
                      <span>🔧</span> BACnet Parameters ({parameters.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {parameters.map((param, idx) => {
                        const getIcon = () => {
                          const name = param.objectName?.toLowerCase() || '';
                          if (name.includes('voltage')) return { icon: '⚡', color: 'border-yellow-500' };
                          if (name.includes('current')) return { icon: '🔌', color: 'border-purple-500' };
                          if (name.includes('power') && !name.includes('factor')) return { icon: '💡', color: 'border-blue-500' };
                          if (name.includes('energy') || name.includes('kwh')) return { icon: '🔋', color: 'border-green-500' };
                          if (name.includes('frequency') || name.includes('freq')) return { icon: '〰️', color: 'border-orange-500' };
                          if (name.includes('factor')) return { icon: '📊', color: 'border-gray-400' };
                          return { icon: '📈', color: 'border-teal-500' };
                        };
                        const { icon, color } = getIcon();
                        
                        // Get live value from BACnet device
                        const liveParam = parameterValues?.parameters?.find(
                          p => p.objectType === param.objectType && p.objectInstance === param.objectInstance
                        );
                        
                        const displayValue = liveParam?.currentValue !== null && liveParam?.currentValue !== undefined
                          ? liveParam.currentValue.toFixed(2)
                          : '--';
                        const unit = param.objectName?.includes('[') 
                          ? param.objectName.match(/\[(.*?)\]/)?.[1] || ''
                          : '';
                        
                        return (
                          <Card key={idx} className={`border-l-4 ${color} h-full`}>
                            <CardHeader className="pb-2 pt-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{icon}</span>
                                <CardTitle className="text-xs font-medium line-clamp-2" title={param.objectName || ''}>
                                  {param.objectName?.replace(/_/g, ' ')}
                                </CardTitle>
                              </div>
                            </CardHeader>
                            <CardContent className="px-3 pb-3">
                              <div className="flex items-baseline gap-1">
                                <p className="text-2xl font-bold">
                                  {displayValue}
                                </p>
                                {unit && <span className="text-sm font-mono">{unit}</span>}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No data available for this meter.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Historical Trends</h3>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg Power</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {formatValue(averageValues.power, "kW")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Energy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {formatValue(averageValues.energy, "kWh")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg Voltage</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {formatValue(averageValues.voltage, "V", 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg Current</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {formatValue(averageValues.current, "A", 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {loadingHistory ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Power Consumption</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 12 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="power" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Voltage & Current</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 12 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="voltage" 
                            stroke="#eab308" 
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="current" 
                            stroke="#8b5cf6" 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Device Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Device Name</label>
                    <p className="font-semibold">{meter.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <p className="font-semibold">{meter.type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                    <p className="font-semibold">{meter.location}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                    <p className="font-semibold font-mono">{meter.ipAddress}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(meter.status)}`} />
                      <span className="font-semibold">{meter.status}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Seen</label>
                    <p className="font-semibold">
                      {meter.lastSeen ? new Date(meter.lastSeen).toLocaleString() : "Never"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="font-semibold">
                      {meter.createdAt ? new Date(meter.createdAt).toLocaleString() : "Unknown"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Meter Configuration */}
            {meter.config && typeof meter.config === 'object' && (
              <Card>
                <CardHeader>
                  <CardTitle>Meter Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(meter.config as any).manufacturer && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Manufacturer</label>
                        <p className="font-semibold">{(meter.config as any).manufacturer}</p>
                      </div>
                    )}
                    {(meter.config as any).model && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Model</label>
                        <p className="font-semibold">{(meter.config as any).model}</p>
                      </div>
                    )}
                    {(meter.config as any).phases && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Phases</label>
                        <p className="font-semibold">{(meter.config as any).phases}-Phase</p>
                      </div>
                    )}
                    {(meter.config as any).ratedVoltage && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Rated Voltage</label>
                        <p className="font-semibold">{(meter.config as any).ratedVoltage} V</p>
                      </div>
                    )}
                    {(meter.config as any).ratedCurrent && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Rated Current</label>
                        <p className="font-semibold">{(meter.config as any).ratedCurrent} A</p>
                      </div>
                    )}
                    {(meter.config as any).modbusAddress && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Modbus Address</label>
                        <p className="font-semibold">{(meter.config as any).modbusAddress}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Current Reading Summary */}
            {currentReading && (
              <Card>
                <CardHeader>
                  <CardTitle>Current Reading Summary</CardTitle>
                  <CardDescription>
                    Last updated: {new Date(currentReading.timestamp).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="border-l-4 border-blue-500 pl-3">
                      <label className="text-sm font-medium text-muted-foreground">Active Power</label>
                      <p className="text-xl font-bold">{currentReading.power?.toFixed(2)} kW</p>
                    </div>
                    <div className="border-l-4 border-green-500 pl-3">
                      <label className="text-sm font-medium text-muted-foreground">Total Energy</label>
                      <p className="text-xl font-bold">{currentReading.energy?.toFixed(1)} kWh</p>
                    </div>
                    <div className="border-l-4 border-yellow-500 pl-3">
                      <label className="text-sm font-medium text-muted-foreground">Voltage</label>
                      <p className="text-xl font-bold">{currentReading.voltage?.toFixed(1)} V</p>
                    </div>
                    <div className="border-l-4 border-purple-500 pl-3">
                      <label className="text-sm font-medium text-muted-foreground">Current</label>
                      <p className="text-xl font-bold">{currentReading.current?.toFixed(1)} A</p>
                    </div>
                    <div className="border-l-4 border-orange-500 pl-3">
                      <label className="text-sm font-medium text-muted-foreground">Frequency</label>
                      <p className="text-xl font-bold">{currentReading.frequency?.toFixed(2)} Hz</p>
                    </div>
                    {currentReading.powerFactor && (
                      <div className="border-l-4 border-gray-400 pl-3">
                        <label className="text-sm font-medium text-muted-foreground">Power Factor</label>
                        <p className="text-xl font-bold">{currentReading.powerFactor?.toFixed(3)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}