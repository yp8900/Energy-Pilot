import { bacnetService } from './bacnet-service';
import type { IStorage } from '../storage';
import type { InsertReading } from '@shared/schema';

interface ParameterReading {
  objectType: number;
  objectInstance: number;
  objectName: string;
  parameterType: string;
  value: number | null;
  units?: string;
  phase?: string;
}

interface MeterReadingData {
  deviceId: number;
  power: number;
  energy: number;
  voltage: number;
  voltageL1L2?: number;
  voltageL2L3?: number;
  voltageL3L1?: number;
  current: number;
  currentL1?: number;
  currentL2?: number;
  currentL3?: number;
  frequency: number;
  powerFactor: number;
}

export class BACnetDataCollector {
  private storage: IStorage;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 15000; // 15 seconds
  private lastPollTime: Date | null = null;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Start the background data collection service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  BACnet data collector is already running');
      return;
    }

    console.log('🚀 Starting BACnet data collector...');
    this.isRunning = true;

    // Ensure BACnet service is initialized
    if (!(bacnetService as any).isServiceRunning) {
      console.log('🔧 Initializing BACnet service for data collection...');
      await bacnetService.initialize();
    }

    // Start polling
    this.pollInterval = setInterval(() => {
      this.collectData().catch(err => {
        console.error('❌ Error during BACnet data collection:', err);
      });
    }, this.POLL_INTERVAL_MS);

    // Collect first batch immediately
    await this.collectData();
    
    console.log(`✅ BACnet data collector started (polling every ${this.POLL_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Stop the background data collection service
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 BACnet data collector stopped');
  }

  /**
   * Main data collection routine
   */
  private async collectData(): Promise<void> {
    try {
      this.lastPollTime = new Date();
      console.log(`📊 [${this.lastPollTime.toISOString()}] Collecting BACnet data...`);

      // Get all devices that have BACnet object mappings
      const allDevices = await this.storage.getDevices();
      const devicesWithBACnet = await Promise.all(
        allDevices.map(async device => {
          const mappings = await this.storage.getBacnetObjectMappingsByDevice(device.id);
          return mappings.length > 0 ? { device, mappings } : null;
        })
      ).then(results => results.filter(Boolean) as { device: any, mappings: any[] }[]);

      if (devicesWithBACnet.length === 0) {
        console.log('ℹ️  No devices with BACnet mappings found - skipping collection');
        return;
      }

      console.log(`🎯 Found ${devicesWithBACnet.length} device(s) with BACnet mappings`);

      // Collect data for each device
      for (const { device, mappings } of devicesWithBACnet) {
        try {
          const reading = await this.collectDeviceData(device, mappings);
          if (reading) {
            // Save reading to database
            await this.storage.createReading(reading);
            console.log(`✅ Saved reading for ${device.name} (ID: ${device.id})`);
          }
        } catch (error) {
          console.error(`❌ Failed to collect data for device ${device.name} (ID: ${device.id}):`, error);
        }
      }

    } catch (error) {
      console.error('❌ Error in collectData:', error);
    }
  }

  /**
   * Collect data from a single device by reading all its BACnet object present values
   */
  private async collectDeviceData(device: any, mappings: any[]): Promise<InsertReading | null> {
    try {
      // Extract BACnet device ID from location string (e.g., "BACnet Device 17800")
      const bacnetDeviceIdMatch = device.location?.match(/BACnet Device (\d+)/i);
      if (!bacnetDeviceIdMatch) {
        console.warn(`⚠️  Device ${device.name} has no BACnet Device ID in location`);
        return null;
      }

      const bacnetDeviceId = parseInt(bacnetDeviceIdMatch[1]);
      const ipAddress = device.ipAddress;

      if (!ipAddress) {
        console.warn(`⚠️  Device ${device.name} has no IP address`);
        return null;
      }

      console.log(`📡 Reading ${mappings.length} parameters from ${device.name} (BACnet Device ${bacnetDeviceId} at ${ipAddress})`);

      // Read all BACnet object present values
      const parameterReadings = await Promise.all(
        mappings.map(async (mapping): Promise<ParameterReading> => {
          try {
            const value = await this.readBACnetObjectValue(
              ipAddress,
              bacnetDeviceId,
              mapping.objectType,
              mapping.objectInstance
            );

            return {
              objectType: mapping.objectType,
              objectInstance: mapping.objectInstance,
              objectName: mapping.objectName,
              parameterType: mapping.parameterType,
              value,
              units: mapping.units,
              phase: mapping.phase
            };
          } catch (error) {
            console.warn(`⚠️  Failed to read ${mapping.objectName}: ${error}`);
            return {
              objectType: mapping.objectType,
              objectInstance: mapping.objectInstance,
              objectName: mapping.objectName,
              parameterType: mapping.parameterType,
              value: null,
              units: mapping.units,
              phase: mapping.phase
            };
          }
        })
      );

      // Aggregate parameters into reading format
      console.log(`🔍 Aggregating ${parameterReadings.length} parameters for ${device.name}:`);
      parameterReadings.forEach(p => {
        console.log(`  - ${p.objectName}: ${p.value} (type: ${p.parameterType || 'N/A'})`);
      });
      const meterData = this.aggregateParametersToReading(parameterReadings);

      // Create reading object
      const reading: InsertReading = {
        deviceId: device.id,
        power: meterData.power,
        energy: meterData.energy,
        voltage: meterData.voltage,
        voltageL1L2: meterData.voltageL1L2,
        voltageL2L3: meterData.voltageL2L3,
        voltageL3L1: meterData.voltageL3L1,
        current: meterData.current,
        currentL1: meterData.currentL1,
        currentL2: meterData.currentL2,
        currentL3: meterData.currentL3,
        frequency: meterData.frequency,
        powerFactor: meterData.powerFactor,
        timestamp: new Date()
      };

      console.log(`📊 ${device.name}: P=${meterData.power.toFixed(2)}kW, V=${meterData.voltage.toFixed(1)}V, I=${meterData.current.toFixed(2)}A, f=${meterData.frequency.toFixed(2)}Hz`);

      return reading;

    } catch (error) {
      console.error(`❌ Error collecting data for ${device.name}:`, error);
      return null;
    }
  }

  /**
   * Read a single BACnet object's present value
   */
  private async readBACnetObjectValue(
    ipAddress: string,
    deviceId: number,
    objectType: number,
    objectInstance: number
  ): Promise<number | null> {
    try {
      const client = (bacnetService as any).client;
      if (!client) {
        throw new Error('BACnet client not initialized');
      }

      // Property ID 85 = present-value
      const result = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout reading BACnet value'));
        }, 5000); // 5 second timeout

        client.readProperty(
          ipAddress,
          { type: objectType, instance: objectInstance },
          85, // PROP_PRESENT_VALUE
          (err: any, value: any) => {
            clearTimeout(timeout);
            if (err) {
              reject(err);
            } else {
              resolve(value);
            }
          }
        );
      });

      // Extract numeric value from BACnet response
      if (result && result.values && result.values.length > 0) {
        const bacnetValue = result.values[0];
        
        // Handle different BACnet value types
        if (typeof bacnetValue.value === 'number') {
          return bacnetValue.value;
        } else if (typeof bacnetValue === 'number') {
          return bacnetValue;
        }
      }

      return null;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Aggregate parameter readings into meter reading format
   */
  private aggregateParametersToReading(parameters: ParameterReading[]): MeterReadingData {
    const result: MeterReadingData = {
      deviceId: 0,
      power: 0,
      energy: 0,
      voltage: 0,
      voltageL1L2: undefined,
      voltageL2L3: undefined,
      voltageL3L1: undefined,
      current: 0,
      currentL1: undefined,
      currentL2: undefined,
      currentL3: undefined,
      frequency: 0,
      powerFactor: 0.9
    };

    let voltageCount = 0;
    let currentCount = 0;
    let powerCount = 0;
    let frequencyCount = 0;
    let powerFactorCount = 0;

    for (const param of parameters) {
      if (param.value === null || param.value === undefined) continue;

      const value = param.value;
      const type = param.parameterType?.toLowerCase() || '';
      const name = param.objectName?.toLowerCase() || '';

      // Check both parameterType and objectName for matching
      if (type.includes('voltage') || name.includes('voltage')) {
        // Store individual phase voltages - check multiple patterns
        const isL1L2 = name.includes('l1-l2') || name.includes('l1 l2') || (name.includes('l1') && name.includes('l2'));
        const isL2L3 = name.includes('l2-l3') || name.includes('l2 l3') || (name.includes('l2') && name.includes('l3') && !isL1L2);
        const isL3L1 = name.includes('l3-l1') || name.includes('l3 l1') || (name.includes('l3') && name.includes('l1') && !isL1L2);
        
        if (isL1L2) {
          result.voltageL1L2 = value;
          console.log(`  ✓ Phase voltage L1-L2: ${value}V (from: ${param.objectName})`);
        } else if (isL2L3) {
          result.voltageL2L3 = value;
          console.log(`  ✓ Phase voltage L2-L3: ${value}V (from: ${param.objectName})`);
        } else if (isL3L1) {
          result.voltageL3L1 = value;
          console.log(`  ✓ Phase voltage L3-L1: ${value}V (from: ${param.objectName})`);
        }
        // Also accumulate for average
        result.voltage += value;
        voltageCount++;
      } else if (type.includes('current') || name.includes('current')) {
        // Store individual phase currents
        const isL1 = name.includes('l1') && !name.includes('l2') && !name.includes('l3');
        const isL2 = name.includes('l2') && !name.includes('l1') && !name.includes('l3');
        const isL3 = name.includes('l3') && !name.includes('l1') && !name.includes('l2');
        
        if (isL1) {
          result.currentL1 = value;
          console.log(`  ✓ Phase current L1: ${value}A (from: ${param.objectName})`);
        } else if (isL2) {
          result.currentL2 = value;
          console.log(`  ✓ Phase current L2: ${value}A (from: ${param.objectName})`);
        } else if (isL3) {
          result.currentL3 = value;
          console.log(`  ✓ Phase current L3: ${value}A (from: ${param.objectName})`);
        }
        // Also accumulate for average
        result.current += value;
        currentCount++
      } else if (type.includes('power') || type === 'active_power' || name.includes('power')) {
        // Exclude power factor from power readings
        if (!name.includes('factor')) {
          result.power += value;
          powerCount++;
        }
      } else if (type.includes('energy') || name.includes('energy')) {
        result.energy = Math.max(result.energy, value); // Take max energy value
      } else if (type.includes('frequency') || name.includes('frequency')) {
        result.frequency += value;
        frequencyCount++;
      } else if (type.includes('power_factor') || type.includes('factor') || name.includes('factor')) {
        result.powerFactor += value;
        powerFactorCount++;
      }
    }

    // Average the accumulated values
    if (voltageCount > 0) result.voltage /= voltageCount;
    if (currentCount > 0) result.current /= currentCount;
    if (powerCount > 0) result.power /= powerCount;
    if (frequencyCount > 0) result.frequency /= frequencyCount;
    if (powerFactorCount > 0) result.powerFactor /= powerFactorCount;

    // Calculate power factor if we have voltage, current, and power (and no direct reading)
    if (powerFactorCount === 0 && result.voltage > 0 && result.current > 0 && result.power > 0) {
      const apparentPower = result.voltage * result.current;
      if (apparentPower > 0) {
        result.powerFactor = Math.min(1.0, result.power / apparentPower);
      }
    }

    return result;
  }

  /**
   * Get collector status
   */
  getStatus() {
    return {
      running: this.isRunning,
      pollIntervalMs: this.POLL_INTERVAL_MS,
      lastPollTime: this.lastPollTime
    };
  }
}

// Singleton instance
let dataCollectorInstance: BACnetDataCollector | null = null;

export function initializeBACnetDataCollector(storage: IStorage): BACnetDataCollector {
  if (!dataCollectorInstance) {
    dataCollectorInstance = new BACnetDataCollector(storage);
  }
  return dataCollectorInstance;
}

export function getBACnetDataCollector(): BACnetDataCollector | null {
  return dataCollectorInstance;
}
