import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Activity, Zap, Target, Calendar } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function PredictiveAnalysis() {
  const [selectedDevice, setSelectedDevice] = useState<number | undefined>(undefined);
  const [trendPeriod, setTrendPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Fetch demand forecast
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['predictive-forecast', selectedDevice],
    queryFn: async () => {
      const params = selectedDevice ? `?deviceId=${selectedDevice}` : '';
      const res = await fetch(`/api/predictive/forecast${params}`);
      if (!res.ok) throw new Error('Failed to fetch forecast');
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch trends
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['predictive-trends', selectedDevice, trendPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDevice) params.append('deviceId', selectedDevice.toString());
      params.append('period', trendPeriod);
      const res = await fetch(`/api/predictive/trends?${params}`);
      if (!res.ok) throw new Error('Failed to fetch trends');
      return res.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Fetch anomalies
  const { data: anomaliesData, isLoading: anomaliesLoading } = useQuery({
    queryKey: ['predictive-anomalies', selectedDevice],
    queryFn: async () => {
      const params = selectedDevice ? `?deviceId=${selectedDevice}` : '';
      const res = await fetch(`/api/predictive/anomalies${params}`);
      if (!res.ok) throw new Error('Failed to fetch anomalies');
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recommendations
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['predictive-recommendations'],
    queryFn: async () => {
      const res = await fetch('/api/predictive/recommendations');
      if (!res.ok) throw new Error('Failed to fetch recommendations');
      return res.json();
    },
    refetchInterval: 600000, // Refresh every 10 minutes
  });

  // Fetch devices for filter
  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await fetch('/api/devices');
      if (!res.ok) throw new Error('Failed to fetch devices');
      return res.json();
    },
  });

  const meters = devices?.filter((d: any) => d.type === 'Smart Meter' || d.type === 'smart_meter') || [];

  // Prepare forecast chart data
  const forecastChartData = forecastData?.forecasts?.[0]?.forecasts.next24Hours.map((point: any) => ({
    time: new Date(point.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
    predicted: point.predictedValue,
    upper: point.confidence.upper,
    lower: point.confidence.lower,
  })) || [];

  // Severity colors
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Predictive Analysis</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered forecasting, trend analysis, and optimization recommendations
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedDevice?.toString() || 'all'} onValueChange={(v) => setSelectedDevice(v === 'all' ? undefined : Number(v))}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Devices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {meters.map((meter: any) => (
                <SelectItem key={meter.id} value={meter.id.toString()}>
                  {meter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="forecast" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="forecast">
            <Zap className="h-4 w-4 mr-2" />
            Demand Forecast
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Energy Trends
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Anomaly Detection
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <Lightbulb className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        {/* Demand Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          {forecastLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Peak Prediction Card */}
              {forecastData?.forecasts?.[0] && (
                <Card>
                  <CardHeader>
                    <CardTitle>Peak Demand Prediction</CardTitle>
                    <CardDescription>
                      Expected peak load for {forecastData.forecasts[0].deviceName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Current Demand</p>
                        <p className="text-3xl font-bold">{forecastData.forecasts[0].currentDemand.toFixed(1)} kW</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Predicted Peak</p>
                        <p className="text-3xl font-bold text-orange-500">
                          {forecastData.forecasts[0].peakPrediction.expectedValue.toFixed(1)} kW
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Expected At</p>
                        <p className="text-xl font-semibold">
                          {new Date(forecastData.forecasts[0].peakPrediction.timestamp).toLocaleString('en', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <Badge variant="secondary">
                          {(forecastData.forecasts[0].peakPrediction.confidence * 100).toFixed(0)}% Confidence
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 24-Hour Forecast Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>24-Hour Demand Forecast</CardTitle>
                  <CardDescription>Predicted power consumption with confidence intervals</CardDescription>
                </CardHeader>
                <CardContent>
                  {forecastChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={forecastChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="upper"
                          stackId="1"
                          stroke="transparent"
                          fill="hsl(var(--muted))"
                          name="Upper Bound"
                        />
                        <Area
                          type="monotone"
                          dataKey="lower"
                          stackId="2"
                          stroke="transparent"
                          fill="transparent"
                          name="Lower Bound"
                        />
                        <Line
                          type="monotone"
                          dataKey="predicted"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          name="Predicted"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No forecast data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Energy Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="flex justify-end">
            <Select value={trendPeriod} onValueChange={(v: any) => setTrendPeriod(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {trendsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendsData?.trends?.map((trend: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{trend.period}</CardTitle>
                      {getTrendIcon(trend.trend)}
                    </div>
                    <CardDescription className="capitalize">{trend.metric} Trend</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Direction</span>
                      <Badge variant={trend.trend === 'increasing' ? 'destructive' : trend.trend === 'decreasing' ? 'default' : 'secondary'}>
                        {trend.trend}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Change</span>
                      <span className="text-sm font-semibold">
                        {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Average</span>
                      <span className="text-sm font-semibold">
                        {trend.average.toFixed(1)} {trend.metric === 'power' ? 'kW' : trend.metric === 'energy' ? 'kWh' : '₹'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Peak</span>
                      <span className="text-sm font-semibold">{trend.peak.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Valley</span>
                      <span className="text-sm font-semibold">{trend.valley.toFixed(1)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Anomaly Detection Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          {anomaliesLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {anomaliesData?.anomalies && anomaliesData.anomalies.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {anomaliesData.anomalies.map((anomaly: any, idx: number) => (
                    <Card key={idx} className="border-l-4" style={{
                      borderLeftColor: anomaly.severity === 'critical' ? 'hsl(var(--destructive))' : 
                                      anomaly.severity === 'high' ? 'orange' : 
                                      anomaly.severity === 'medium' ? 'yellow' : 'gray'
                    }}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            <CardTitle className="text-lg">{anomaly.deviceName}</CardTitle>
                          </div>
                          <Badge variant={getSeverityColor(anomaly.severity) as any}>
                            {anomaly.severity}
                          </Badge>
                        </div>
                        <CardDescription className="capitalize">
                          {anomaly.metric} Anomaly
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm">{anomaly.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Actual Value</p>
                            <p className="font-semibold">{anomaly.actualValue.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Expected Value</p>
                            <p className="font-semibold">{anomaly.expectedValue.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Deviation</p>
                            <p className={`font-semibold ${anomaly.deviation > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Detected at: {new Date(anomaly.timestamp).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Target className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">No Anomalies Detected</p>
                    <p className="text-sm">All systems operating within normal parameters</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          {recommendationsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {recommendationsData?.recommendations && recommendationsData.recommendations.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {recommendationsData.recommendations.map((rec: any) => (
                    <Card key={rec.id} className="border-l-4" style={{
                      borderLeftColor: rec.priority === 'high' ? 'hsl(var(--destructive))' : 
                                      rec.priority === 'medium' ? 'orange' : 'gray'
                    }}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-yellow-500" />
                            <CardTitle className="text-lg">{rec.title}</CardTitle>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={getPriorityColor(rec.priority) as any}>
                              {rec.priority} priority
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {rec.category}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Potential Energy Savings</p>
                            <p className="text-2xl font-bold text-green-600">
                              {rec.potentialSavings.toFixed(0)} kWh/month
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Cost Savings</p>
                            <p className="text-2xl font-bold text-green-600">
                              ₹{rec.costSavings.toFixed(0)}/month
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">No Recommendations Available</p>
                    <p className="text-sm">System is running optimally</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
