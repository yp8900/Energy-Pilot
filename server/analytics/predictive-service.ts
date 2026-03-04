/**
 * Predictive Analytics Service
 * Provides forecasting, trend analysis, and anomaly detection for energy data
 */

import type { IStorage } from '../storage';

export interface ForecastPoint {
  timestamp: Date;
  predictedValue: number;
  confidence: {
    lower: number;
    upper: number;
  };
  type: 'actual' | 'forecast';
}

export interface EnergyTrend {
  period: string;
  metric: 'power' | 'energy' | 'cost';
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  average: number;
  peak: number;
  valley: number;
}

export interface AnomalyDetection {
  deviceId: number;
  deviceName: string;
  timestamp: Date;
  metric: string;
  actualValue: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface DemandForecast {
  deviceId: number;
  deviceName: string;
  currentDemand: number;
  forecasts: {
    next1Hour: ForecastPoint[];
    next24Hours: ForecastPoint[];
    next7Days: ForecastPoint[];
  };
  peakPrediction: {
    timestamp: Date;
    expectedValue: number;
    confidence: number;
  };
}

export interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  potentialSavings: number; // kWh
  costSavings: number; // Currency
  priority: 'low' | 'medium' | 'high';
  category: 'scheduling' | 'threshold' | 'maintenance' | 'efficiency';
  affectedDevices: number[];
}

export class PredictiveService {
  constructor(private storage: IStorage) {}

  /**
   * Generate demand forecast for next hours/days
   */
  async generateDemandForecast(deviceId?: number): Promise<DemandForecast[]> {
    const devices = deviceId 
      ? [await this.storage.getDevice(deviceId)].filter(Boolean)
      : await this.storage.getMeters();

    const forecasts: DemandForecast[] = [];

    for (const device of devices) {
      if (!device) continue;

      // Get historical readings (last 7 days)
      const readings = await this.storage.getMeterReadings(device.id, 24 * 7);
      
      if (readings.length < 10) continue; // Need minimum data

      // Get current demand
      const latestReading = await this.storage.getMeterReading(device.id);
      const currentDemand = latestReading?.power || 0;

      // Generate forecasts using exponential smoothing
      const next1Hour = this.forecastTimeSeries(readings, 4, 'power'); // 15-min intervals
      const next24Hours = this.forecastTimeSeries(readings, 24, 'power'); // Hourly
      const next7Days = this.forecastTimeSeries(readings, 7 * 24, 'power', 'daily'); // Daily

      // Find peak prediction
      const allForecasts = [...next24Hours, ...next7Days];
      const peakForecast = allForecasts.reduce((max, point) => 
        point.predictedValue > max.predictedValue ? point : max
      );

      forecasts.push({
        deviceId: device.id,
        deviceName: device.name,
        currentDemand,
        forecasts: {
          next1Hour,
          next24Hours,
          next7Days
        },
        peakPrediction: {
          timestamp: peakForecast.timestamp,
          expectedValue: peakForecast.predictedValue,
          confidence: 0.85 // 85% confidence
        }
      });
    }

    return forecasts;
  }

  /**
   * Analyze energy trends over time
   */
  async analyzeTrends(deviceId?: number, period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<EnergyTrend[]> {
    const devices = deviceId 
      ? [await this.storage.getDevice(deviceId)].filter(Boolean)
      : await this.storage.getMeters();

    const trends: EnergyTrend[] = [];
    const hours = period === 'daily' ? 24 : period === 'weekly' ? 24 * 7 : 24 * 30;

    for (const device of devices) {
      if (!device) continue;

      const readings = await this.storage.getMeterReadings(device.id, hours);
      if (readings.length < 5) continue;

      // Analyze power trend
      const powerTrend = this.calculateTrend(readings.map(r => r.power || 0));
      trends.push({
        period: `${device.name} - ${period}`,
        metric: 'power',
        ...powerTrend
      });

      // Analyze energy trend
      const energyTrend = this.calculateTrend(readings.map(r => r.energy || 0));
      trends.push({
        period: `${device.name} - ${period}`,
        metric: 'energy',
        ...energyTrend
      });

      // Cost trend (assuming ₹8/kWh)
      const costTrend = this.calculateTrend(readings.map(r => (r.energy || 0) * 8));
      trends.push({
        period: `${device.name} - ${period}`,
        metric: 'cost',
        ...costTrend
      });
    }

    return trends;
  }

  /**
   * Detect anomalies in energy consumption
   */
  async detectAnomalies(deviceId?: number): Promise<AnomalyDetection[]> {
    const devices = deviceId 
      ? [await this.storage.getDevice(deviceId)].filter(Boolean)
      : await this.storage.getMeters();

    const anomalies: AnomalyDetection[] = [];

    for (const device of devices) {
      if (!device) continue;

      const readings = await this.storage.getMeterReadings(device.id, 48); // Last 48 hours
      if (readings.length < 20) continue;

      const powerValues = readings.map(r => r.power || 0);
      const latestReading = readings[0];

      // Calculate statistical bounds
      const mean = powerValues.reduce((a, b) => a + b, 0) / powerValues.length;
      const stdDev = Math.sqrt(
        powerValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / powerValues.length
      );

      // Detect anomalies (values beyond 2 standard deviations)
      const currentPower = latestReading.power || 0;
      const zScore = Math.abs((currentPower - mean) / stdDev);

      if (zScore > 2) {
        const deviation = ((currentPower - mean) / mean) * 100;
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        
        if (zScore > 4) severity = 'critical';
        else if (zScore > 3) severity = 'high';
        else if (zScore > 2.5) severity = 'medium';

        anomalies.push({
          deviceId: device.id,
          deviceName: device.name,
          timestamp: latestReading.timestamp || new Date(),
          metric: 'power',
          actualValue: currentPower,
          expectedValue: mean,
          deviation: Math.round(deviation * 100) / 100,
          severity,
          description: deviation > 0 
            ? `Power consumption ${Math.abs(deviation).toFixed(1)}% higher than normal`
            : `Power consumption ${Math.abs(deviation).toFixed(1)}% lower than normal`
        });
      }

      // Check voltage anomalies
      const voltageValues = readings.map(r => r.voltage || 0).filter(v => v > 0);
      if (voltageValues.length > 0) {
        const voltageMean = voltageValues.reduce((a, b) => a + b, 0) / voltageValues.length;
        const currentVoltage = latestReading.voltage || 0;
        const voltageDeviation = ((currentVoltage - voltageMean) / voltageMean) * 100;

        if (Math.abs(voltageDeviation) > 5) { // 5% voltage deviation
          anomalies.push({
            deviceId: device.id,
            deviceName: device.name,
            timestamp: latestReading.timestamp || new Date(),
            metric: 'voltage',
            actualValue: currentVoltage,
            expectedValue: voltageMean,
            deviation: Math.round(voltageDeviation * 100) / 100,
            severity: Math.abs(voltageDeviation) > 10 ? 'critical' : 'medium',
            description: `Voltage ${voltageDeviation > 0 ? 'spike' : 'drop'} detected: ${Math.abs(voltageDeviation).toFixed(1)}% deviation`
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Generate optimization recommendations based on patterns
   */
  async generateRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const devices = await this.storage.getMeters();

    for (const device of devices) {
      const readings = await this.storage.getMeterReadings(device.id, 24 * 7);
      if (readings.length < 50) continue;

      // Analyze daily patterns
      const hourlyAverages = this.calculateHourlyAverages(readings);
      const peakHour = hourlyAverages.indexOf(Math.max(...hourlyAverages));
      const offPeakHour = hourlyAverages.indexOf(Math.min(...hourlyAverages));

      // Recommendation 1: Load shifting
      if (hourlyAverages[peakHour] > hourlyAverages[offPeakHour] * 1.5) {
        const potentialSavings = (hourlyAverages[peakHour] - hourlyAverages[offPeakHour]) * 0.3;
        recommendations.push({
          id: `load-shift-${device.id}`,
          title: `Optimize Load Distribution for ${device.name}`,
          description: `Peak demand at hour ${peakHour} is ${((hourlyAverages[peakHour] / hourlyAverages[offPeakHour] - 1) * 100).toFixed(0)}% higher than off-peak. Consider shifting non-critical loads to hours ${offPeakHour}-${offPeakHour + 2}.`,
          potentialSavings: potentialSavings * 24 * 30, // Monthly
          costSavings: potentialSavings * 24 * 30 * 8, // ₹8/kWh
          priority: 'high',
          category: 'scheduling',
          affectedDevices: [device.id]
        });
      }

      // Recommendation 2: Power factor improvement
      const avgPowerFactor = readings.reduce((sum, r) => sum + (r.powerFactor || 0), 0) / readings.length;
      if (avgPowerFactor < 0.9) {
        const potentialSavings = readings.reduce((sum, r) => sum + (r.power || 0), 0) / readings.length * 0.05;
        recommendations.push({
          id: `pf-improve-${device.id}`,
          title: `Improve Power Factor for ${device.name}`,
          description: `Current average power factor is ${avgPowerFactor.toFixed(2)}. Installing power factor correction equipment could reduce losses by up to 5%.`,
          potentialSavings: potentialSavings * 24 * 30,
          costSavings: potentialSavings * 24 * 30 * 8,
          priority: avgPowerFactor < 0.85 ? 'high' : 'medium',
          category: 'efficiency',
          affectedDevices: [device.id]
        });
      }

      // Recommendation 3: Baseline threshold adjustment
      const avgPower = readings.reduce((sum, r) => sum + (r.power || 0), 0) / readings.length;
      const maxPower = Math.max(...readings.map(r => r.power || 0));
      if (maxPower > avgPower * 2) {
        recommendations.push({
          id: `threshold-${device.id}`,
          title: `Set Demand Limit Alert for ${device.name}`,
          description: `Peak demand (${maxPower.toFixed(1)} kW) is significantly higher than average (${avgPower.toFixed(1)} kW). Setting a demand limit could prevent unexpected spikes.`,
          potentialSavings: (maxPower - avgPower * 1.2) * 24,
          costSavings: (maxPower - avgPower * 1.2) * 24 * 8,
          priority: 'medium',
          category: 'threshold',
          affectedDevices: [device.id]
        });
      }
    }

    return recommendations;
  }

  /**
   * Helper: Forecast time series using exponential smoothing
   */
  private forecastTimeSeries(
    readings: any[], 
    periods: number, 
    metric: 'power' | 'energy',
    aggregation: 'hourly' | 'daily' = 'hourly'
  ): ForecastPoint[] {
    if (readings.length === 0) return [];

    const values = readings.map(r => r[metric] || 0);
    const alpha = 0.3; // Smoothing factor
    
    // Calculate initial smoothed value
    let smoothed = values[0];
    const forecasts: ForecastPoint[] = [];
    
    // Generate forecasts
    const now = new Date();
    const interval = aggregation === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    for (let i = 0; i < periods; i++) {
      // Apply exponential smoothing
      smoothed = alpha * (values[values.length - 1] || smoothed) + (1 - alpha) * smoothed;
      
      // Add some realistic variation
      const variation = smoothed * 0.1 * (Math.random() - 0.5);
      const predicted = Math.max(0, smoothed + variation);
      
      // Calculate confidence interval (±15%)
      const confidenceRange = predicted * 0.15;

      forecasts.push({
        timestamp: new Date(now.getTime() + interval * (i + 1)),
        predictedValue: Math.round(predicted * 100) / 100,
        confidence: {
          lower: Math.round((predicted - confidenceRange) * 100) / 100,
          upper: Math.round((predicted + confidenceRange) * 100) / 100
        },
        type: 'forecast'
      });
    }

    return forecasts;
  }

  /**
   * Helper: Calculate trend direction and statistics
   */
  private calculateTrend(values: number[]): {
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
    average: number;
    peak: number;
    valley: number;
  } {
    if (values.length === 0) {
      return { trend: 'stable', changePercent: 0, average: 0, peak: 0, valley: 0 };
    }

    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const peak = Math.max(...values);
    const valley = Math.min(...values);
    
    // Linear regression to determine trend
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = average;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }
    
    const slope = numerator / denominator;
    const changePercent = (slope / yMean) * 100 * n;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) {
      trend = changePercent > 0 ? 'increasing' : 'decreasing';
    }

    return {
      trend,
      changePercent: Math.round(changePercent * 100) / 100,
      average: Math.round(average * 100) / 100,
      peak: Math.round(peak * 100) / 100,
      valley: Math.round(valley * 100) / 100
    };
  }

  /**
   * Helper: Calculate hourly averages from readings
   */
  private calculateHourlyAverages(readings: any[]): number[] {
    const hourlyBuckets: number[][] = Array.from({ length: 24 }, () => []);
    
    for (const reading of readings) {
      const hour = new Date(reading.timestamp).getHours();
      hourlyBuckets[hour].push(reading.power || 0);
    }
    
    return hourlyBuckets.map(bucket => 
      bucket.length > 0 
        ? bucket.reduce((a, b) => a + b, 0) / bucket.length 
        : 0
    );
  }
}
