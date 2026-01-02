import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, TrendingUp, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CustomAnalytics() {
  const [selectedPeriod, setSelectedPeriod] = useState("week");

  const { data, isLoading } = useQuery({
    queryKey: ["custom-analytics", selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/custom?period=${selectedPeriod}`);
      if (!res.ok) throw new Error("Failed to fetch custom analytics");
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      default: return "Period";
    }
  };

  // Group calculations by category
  const groupedCalculations = data?.calculations?.reduce((acc: any, calc: any) => {
    if (!acc[calc.category]) {
      acc[calc.category] = [];
    }
    acc[calc.category].push(calc);
    return acc;
  }, {}) || {};

  const categories = Object.keys(groupedCalculations);

  if (isLoading) {
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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            Custom Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Advanced calculations and insights based on your energy data
          </p>
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

      {/* Summary Stats */}
      {data?.metadata && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Data Summary - {getPeriodLabel()}</CardTitle>
            <CardDescription>
              {data.daysElapsed.toFixed(1)} days of data analyzed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Energy</p>
                <p className="text-xl font-bold">{data.metadata.totalEnergy.toFixed(1)} <span className="text-sm font-normal">kWh</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-xl font-bold">₹{data.metadata.totalCost.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peak Power</p>
                <p className="text-xl font-bold">{data.metadata.maxPower.toFixed(1)} <span className="text-sm font-normal">kW</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Devices</p>
                <p className="text-xl font-bold">{data.metadata.deviceCount}</p>
                {data.metadata.devicesWithData !== undefined && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.metadata.devicesWithData} with valid data
                    {data.metadata.devicesWithoutData > 0 && (
                      <span className="text-red-500"> • {data.metadata.devicesWithoutData} N/A</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calculations by Category */}
      <Tabs defaultValue={categories[0]} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {categories.map((category) => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedCalculations[category].map((calc: any) => (
                <Card key={calc.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{calc.icon}</span>
                        <div>
                          <CardTitle className="text-base">{calc.name}</CardTitle>
                        </div>
                      </div>
                      <div className="relative group">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute right-0 top-6 w-64 p-2 bg-popover border rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <p className="text-xs text-muted-foreground">{calc.description}</p>
                          <p className="text-xs text-primary mt-2 font-mono">{calc.formula}</p>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      {calc.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold font-mono">
                        {typeof calc.value === 'number' ? calc.value.toFixed(2) : calc.value}
                      </p>
                      <p className="text-sm text-muted-foreground">{calc.unit}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Info Box */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            How to Add Custom Calculations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Edit <code className="bg-muted px-2 py-1 rounded">custom-analytics.json</code> to add new calculations.
          </p>
          <p className="font-mono text-xs bg-muted p-2 rounded">
            Available parameters: totalEnergy, totalCost, avgPower, maxPower, deviceCount, daysElapsed, avgVoltage
          </p>
          <p>
            Example: <code className="bg-muted px-2 py-1 rounded">"formula": "(totalEnergy / deviceCount) * 100"</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
