import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Zap, Activity, Gauge } from "lucide-react";
import { type Device, type Reading, type BacnetObjectMapping } from "@shared/schema";
import { useQuery, useQueries } from "@tanstack/react-query";
import { MeterDetailDialog } from "@/components/MeterDetailDialog";

export function Meters() {
  const [selectedMeter, setSelectedMeter] = useState<Device | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch all meters
  const { data: meters = [], isLoading: loadingMeters } = useQuery({
    queryKey: ["/api/meters"],
    queryFn: async () => {
      const res = await fetch("/api/meters");
      if (!res.ok) throw new Error("Failed to fetch meters");
      return res.json() as Promise<Device[]>;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch current readings for all meters
  const meterReadings = useQueries({
    queries: meters.map((meter) => ({
      queryKey: ["/api/meters", meter.id, "reading"],
      queryFn: async () => {
        const res = await fetch(`/api/meters/${meter.id}/reading`);
        if (!res.ok) throw new Error("Failed to fetch meter reading");
        const reading = await res.json() as Reading;
        return { meterId: meter.id, reading };
      },
      refetchInterval: 2000, // Real-time updates every 2 seconds
      enabled: !!meter.id,
    })),
  });

  // Fetch BACnet parameters for all meters
  const meterParameters = useQueries({
    queries: meters.map((meter) => ({
      queryKey: ["/api/devices", meter.id, "bacnet-parameters"],
      queryFn: async () => {
        const res = await fetch(`/api/devices/${meter.id}/bacnet-parameters`);
        if (!res.ok) throw new Error("Failed to fetch BACnet parameters");
        const data = await res.json() as { success: boolean; deviceId: number; parameters: BacnetObjectMapping[] };
        return { meterId: meter.id, parameters: data.parameters };
      },
      enabled: !!meter.id,
    })),
  });

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

  const formatValue = (value: number | undefined, unit: string, decimals = 1, isOffline = false, hasData = true) => {
    // No data available (reading is null/undefined or no recent data)
    if (!hasData || value === undefined || value === null) {
      return <span className="text-red-500 font-semibold">N/A</span>;
    }
    // Device is offline
    if (isOffline) {
      return <span className="text-gray-400">Offline</span>;
    }
    // Has data - show the value
    return `${value.toFixed(decimals)} ${unit}`;
  };

  const handleViewDetails = (meter: Device) => {
    setSelectedMeter(meter);
    setDialogOpen(true);
  };

  if (loadingMeters) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Energy Meters</h1>
          <p className="text-muted-foreground">
            Monitor electrical parameters across {meters.length} connected meters
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="table">Detailed Table</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meters.map((meter) => {
              const readingQuery = meterReadings.find(q => 
                q.data?.meterId === meter.id
              );
              const reading = readingQuery?.data?.reading;
              const isLoading = readingQuery?.isLoading;
              // Check if we have meaningful data - need at least 2 valid parameters
              const validParams = [
                reading?.power && reading.power > 0,
                reading?.voltage && reading.voltage > 0,
                reading?.current && reading.current > 0,
                reading?.frequency && reading.frequency > 0
              ].filter(Boolean).length;
              const hasData = reading && validParams >= 2;

              const parametersQuery = meterParameters.find(q => 
                q.data?.meterId === meter.id
              );
              const parameters = parametersQuery?.data?.parameters || [];

              return (
                <Card key={meter.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{meter.name}</CardTitle>
                        <CardDescription>
                          {meter.location} • {meter.type.replace('_', ' ')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${getStatusColor(meter.status)}`}
                          title={meter.status}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(meter)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    ) : parameters.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xl text-blue-500">💡</span>
                            <div>
                              <p className="text-xs text-muted-foreground">Power</p>
                              <p className={`text-sm font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                                {formatValue(reading?.power, "kW", 1, meter.status === 'offline', hasData)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl text-green-500">🔋</span>
                            <div>
                              <p className="text-xs text-muted-foreground">Energy</p>
                              <p className={`text-sm font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                                {formatValue(reading?.energy, "kWh", 0, meter.status === 'offline', hasData)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl text-yellow-500">⚡</span>
                            <div>
                              <p className="text-xs text-muted-foreground">Voltage</p>
                              <p className={`text-sm font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                                {formatValue(reading?.voltage, "V", 1, meter.status === 'offline', hasData)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl text-purple-500">🔌</span>
                            <div>
                              <p className="text-xs text-muted-foreground">Current</p>
                              <p className={`text-sm font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                                {formatValue(reading?.current, "A", 1, meter.status === 'offline', hasData)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl text-orange-500">〰️</span>
                            <div>
                              <p className="text-xs text-muted-foreground">Frequency</p>
                              <p className={`text-sm font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                                {formatValue(reading?.frequency, "Hz", 1, meter.status === 'offline', hasData)}
                              </p>
                            </div>
                          </div>
                        </div>
                        {parameters.length > 5 && (
                          <div className="text-xs text-muted-foreground text-center">
                            {parameters.length} BACnet parameters • Click eye icon for details
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-500" />
                          <div>
                            <p className="text-muted-foreground">Power</p>
                            <p className={`font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                              {formatValue(reading?.power, "kW", 1, meter.status === 'offline', hasData)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-green-500" />
                          <div>
                            <p className="text-muted-foreground">Energy</p>
                            <p className={`font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                              {formatValue(reading?.energy, "kWh", 1, meter.status === 'offline', hasData)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-yellow-500" />
                          <div>
                            <p className="text-muted-foreground">Voltage</p>
                            <p className={`font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                              {formatValue(reading?.voltage, "V", 0, meter.status === 'offline', hasData)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-purple-500" />
                          <div>
                            <p className="text-muted-foreground">Current</p>
                            <p className={`font-semibold ${!hasData ? 'text-red-500' : meter.status === 'offline' ? 'text-gray-400' : ''}`}>
                              {formatValue(reading?.current, "A", 1, meter.status === 'offline', hasData)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <Badge className={getStatusBadge(meter.status)}>
                        {meter.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Meter Readings Table</CardTitle>
              <CardDescription>
                Real-time electrical parameters for all connected meters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meter Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Power (kW)</TableHead>
                    <TableHead className="text-right">Energy (kWh)</TableHead>
                    <TableHead className="text-right">Voltage (V)</TableHead>
                    <TableHead className="text-right">Current (A)</TableHead>
                    <TableHead className="text-right">Frequency (Hz)</TableHead>
                    <TableHead className="text-right">Power Factor</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meters.map((meter) => {
                    const readingQuery = meterReadings.find(q => 
                      q.data?.meterId === meter.id
                    );
                    const reading = readingQuery?.data?.reading;
                    const isLoading = readingQuery?.isLoading;

                    return (
                      <TableRow key={meter.id}>
                        <TableCell className="font-medium">{meter.name}</TableCell>
                        <TableCell>{meter.location}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(meter.status)}>
                            {meter.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isLoading ? (
                            <div className="animate-pulse h-4 bg-gray-200 rounded w-12 ml-auto"></div>
                          ) : (
                            <span className={meter.status === 'offline' ? 'text-gray-400' : ''}>
                              {formatValue(reading?.power, "", 1, meter.status === 'offline')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isLoading ? (
                            <div className="animate-pulse h-4 bg-gray-200 rounded w-16 ml-auto"></div>
                          ) : (
                            <span className={meter.status === 'offline' ? 'text-gray-400' : ''}>
                              {meter.status === 'offline' ? 'No Data' : formatValue(reading?.energy, "")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isLoading ? (
                            <div className="animate-pulse h-4 bg-gray-200 rounded w-12 ml-auto"></div>
                          ) : (
                            <span className={meter.status === 'offline' ? 'text-gray-400' : ''}>
                              {formatValue(reading?.voltage, "", 0, meter.status === 'offline')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isLoading ? (
                            <div className="animate-pulse h-4 bg-gray-200 rounded w-12 ml-auto"></div>
                          ) : (
                            <span className={meter.status === 'offline' ? 'text-gray-400' : ''}>
                              {formatValue(reading?.current, "", 0, meter.status === 'offline')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isLoading ? (
                            <div className="animate-pulse h-4 bg-gray-200 rounded w-12 ml-auto"></div>
                          ) : (
                            <span className={meter.status === 'offline' ? 'text-gray-400' : ''}>
                              {formatValue(reading?.frequency, "", 1, meter.status === 'offline')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isLoading ? (
                            <div className="animate-pulse h-4 bg-gray-200 rounded w-12 ml-auto"></div>
                          ) : (
                            <span className={meter.status === 'offline' ? 'text-gray-400' : ''}>
                              {formatValue(reading?.powerFactor, "", 2, meter.status === 'offline')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(meter)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedMeter && (
        <MeterDetailDialog
          meter={selectedMeter}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}