import ModbusRTU from 'modbus-serial';
import { EventEmitter } from 'events';
import { 
  MeterDefinition, 
  MeterRegister,
  METER_DEFINITIONS,
  getGenericMeterDefinition,
  getSupportedManufacturers 
} from './meter-definitions';
import {
  parseModbusValue,
  formatValue,
  applyScaling,
  getWordCount,
  isValidValue,
  detectByteOrder
} from './modbus-data-parser';
import type { ByteOrder } from './meter-definitions';

/**
 * Modbus Device Information
 */
export interface ModbusDevice {
  address: number;
  deviceType: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  firmwareVersion?: string;
  registers: MeterRegister[];
  byteOrder?: ByteOrder;
  status: 'online' | 'offline';
  lastSeen: Date;
}

/**
 * Modbus Register Definition (legacy, use MeterRegister from meter-definitions)
 */
export interface ModbusRegister {
  address: number;
  name: string;
  type: 'holding' | 'input' | 'coil' | 'discrete';
  dataType: 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'float64';
  unit: string;
  scale: number;
  description: string;
}

/**
 * Modbus RTU Scanner Service
 * Scans RS485 bus for Modbus devices and identifies energy meters
 */
export class ModbusScanner extends EventEmitter {
  private client: ModbusRTU;
  private discoveredDevices: Map<number, ModbusDevice> = new Map();
  private isScanning: boolean = false;

  constructor() {
    super();
    this.client = new ModbusRTU();
  }

  /**
   * Connect to RS485 port (via Loytec BACnet gateway or direct serial)
   */
  async connect(connectionType: 'serial' | 'tcp', options: any): Promise<void> {
    try {
      if (connectionType === 'serial') {
        // Direct serial connection (if you have RS485 adapter)
        await this.client.connectRTUBuffered(options.port, {
          baudRate: options.baudRate || 9600,
          parity: options.parity || 'none',
          dataBits: options.dataBits || 8,
          stopBits: options.stopBits || 1,
        });
        console.log(`✅ Connected to Modbus RTU on ${options.port}`);
      } else {
        // TCP connection (via BACnet gateway like Loytec)
        await this.client.connectTCP(options.host, { port: options.port || 502 });
        console.log(`✅ Connected to Modbus TCP at ${options.host}:${options.port}`);
      }

      // Set timeout for Modbus operations
      this.client.setTimeout(1000);
      
    } catch (error: any) {
      console.error('❌ Failed to connect to Modbus:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from Modbus
   */
  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      this.client.close(() => {
        console.log('🔌 Modbus connection closed');
      });
    }
  }

  /**
   * Scan for Modbus devices on the bus
   * @param startAddress - Starting Modbus address (default: 1)
   * @param endAddress - Ending Modbus address (default: 247)
   * @param timeout - Timeout per device in ms (default: 500)
   */
  async scanBus(
    startAddress: number = 1,
    endAddress: number = 247,
    timeout: number = 500
  ): Promise<ModbusDevice[]> {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }

    this.isScanning = true;
    this.discoveredDevices.clear();

    console.log(`🔍 Starting Modbus RTU bus scan (addresses ${startAddress}-${endAddress})...`);
    
    const scanStartTime = Date.now();
    let devicesFound = 0;

    for (let address = startAddress; address <= endAddress; address++) {
      try {
        // Set current slave address
        this.client.setID(address);
        this.client.setTimeout(timeout);

        // Ping device by reading a common register (holding register 0)
        // Most devices have at least one holding register
        const response = await this.client.readHoldingRegisters(0, 1);
        
        if (response && response.data) {
          console.log(`✅ Device found at address ${address}`);
          devicesFound++;

          // Identify device type
          const device = await this.identifyDevice(address);
          this.discoveredDevices.set(address, device);

          this.emit('device-found', device);
        }
      } catch (error: any) {
        // Device not responding at this address (normal during scan)
        // Only log if it's not a timeout
        if (!error.message?.includes('Timeout') && !error.message?.includes('timed out')) {
          console.log(`⏭️  Address ${address}: ${error.message}`);
        }
      }

      // Progress update every 50 addresses
      if (address % 50 === 0) {
        console.log(`📊 Scan progress: ${address}/${endAddress} addresses checked, ${devicesFound} devices found`);
      }
    }

    const scanDuration = ((Date.now() - scanStartTime) / 1000).toFixed(2);
    console.log(`✅ Bus scan completed in ${scanDuration}s. Found ${devicesFound} devices.`);

    this.isScanning = false;
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Identify device type and read capabilities using meter definitions
   */
  private async identifyDevice(address: number): Promise<ModbusDevice> {
    console.log(`🔍 Identifying device at address ${address}...`);

    const device: ModbusDevice = {
      address,
      deviceType: 'Unknown',
      manufacturer: 'Unknown',
      model: 'Unknown',
      registers: [],
      status: 'online',
      lastSeen: new Date(),
    };

    try {
      this.client.setID(address);
      
      // Try to identify by reading manufacturer-specific registers
      for (const meterDef of METER_DEFINITIONS) {
        try {
          const { register, type, expectedValue } = meterDef.identificationMethod;
          
          let result;
          if (type === 'holding') {
            result = await this.client.readHoldingRegisters(register, 2);
          } else {
            result = await this.client.readInputRegisters(register, 2);
          }

          if (result && result.data) {
            // Check if identification value matches
            let matches = false;
            
            if (expectedValue) {
              if (typeof expectedValue === 'number') {
                matches = result.data[0] === expectedValue;
              } else if (typeof expectedValue === 'string') {
                const buffer = Buffer.allocUnsafe(4);
                buffer.writeUInt16BE(result.data[0], 0);
                buffer.writeUInt16BE(result.data[1], 2);
                const str = buffer.toString('ascii');
                matches = str.includes(expectedValue);
              }
            } else {
              // If no expected value, just check if register is readable
              matches = true;
            }

            if (matches) {
              device.manufacturer = meterDef.manufacturer;
              device.model = meterDef.model;
              device.deviceType = 'Energy Meter';
              device.byteOrder = meterDef.defaultByteOrder;
              
              console.log(`   ✅ Identified as ${meterDef.manufacturer} ${meterDef.model}`);
              
              // Use meter definition's registers
              device.registers = await this.probeDefinedRegisters(address, meterDef);
              return device;
            }
          }
        } catch (error) {
          // This meter definition doesn't match, try next
          continue;
        }
      }

      // If no specific meter identified, try generic energy meter registers
      console.log(`   ℹ️  Using generic energy meter definition`);
      const genericDef = getGenericMeterDefinition();
      device.manufacturer = 'Generic';
      device.model = 'IEC 61850';
      device.deviceType = 'Energy Meter';
      device.byteOrder = genericDef.defaultByteOrder;
      device.registers = await this.probeDefinedRegisters(address, genericDef);

    } catch (error: any) {
      console.warn(`   ⚠️  Could not fully identify device: ${error.message}`);
    }

    return device;
  }

  /**
   * Probe device for available registers using meter definition
   */
  private async probeDefinedRegisters(
    address: number, 
    meterDef: MeterDefinition
  ): Promise<MeterRegister[]> {
    const availableRegisters: MeterRegister[] = [];

    this.client.setID(address);
    this.client.setTimeout(300);

    // Test key registers from each category
    const categoriesToTest = ['power', 'energy', 'voltage', 'current', 'frequency', 'power_factor'];
    const registersToTest: MeterRegister[] = [];
    
    for (const category of categoriesToTest) {
      const categoryRegs = meterDef.registers.filter(r => r.category === category);
      if (categoryRegs.length > 0) {
        // Test first register from each category
        registersToTest.push(categoryRegs[0]);
      }
    }

    console.log(`   🔍 Testing ${registersToTest.length} key registers...`);

    for (const register of registersToTest) {
      try {
        const wordCount = getWordCount(register.dataType);
        
        let response;
        if (register.type === 'holding') {
          response = await this.client.readHoldingRegisters(register.address, wordCount);
        } else {
          response = await this.client.readInputRegisters(register.address, wordCount);
        }

        if (response && response.data && response.data.length > 0) {
          // Parse value to verify it's valid
          const value = parseModbusValue(
            response.data, 
            register.dataType, 
            register.byteOrder || meterDef.defaultByteOrder
          );

          if (value !== null && isValidValue(value, register.dataType)) {
            // Register is readable and has valid data
            console.log(`      ✓ ${register.name}: ${formatValue(value, register.unit, register.decimals)}`);
            
            // Add this register and all registers in same category
            const categoryRegs = meterDef.registers.filter(r => r.category === register.category);
            for (const reg of categoryRegs) {
              if (!availableRegisters.find(r => r.address === reg.address)) {
                availableRegisters.push(reg);
              }
            }
          }
        }
      } catch (error) {
        // Register not available
        continue;
      }
    }

    console.log(`   ✅ Found ${availableRegisters.length} available registers`);
    return availableRegisters;
  }

  /**
   * Read current values from a device with proper data type handling
   */
  async readDevice(address: number): Promise<Map<string, any>> {
    const device = this.discoveredDevices.get(address);
    if (!device) {
      throw new Error(`Device at address ${address} not found`);
    }

    const values = new Map<string, any>();
    this.client.setID(address);

    for (const register of device.registers) {
      try {
        const wordCount = getWordCount(register.dataType);
        
        let response;
        if (register.type === 'holding') {
          response = await this.client.readHoldingRegisters(register.address, wordCount);
        } else {
          response = await this.client.readInputRegisters(register.address, wordCount);
        }

        if (response && response.data) {
          // Parse value using proper data type and byte order
          let value = parseModbusValue(
            response.data,
            register.dataType,
            register.byteOrder || device.byteOrder || 'BE'
          );

          if (value !== null && typeof value === 'number') {
            // Apply scaling and offset
            value = applyScaling(value, register.scale, register.offset || 0);
          }

          if (value !== null && isValidValue(value, register.dataType)) {
            values.set(register.name, {
              value,
              formattedValue: formatValue(value, register.unit, register.decimals || 2),
              unit: register.unit,
              category: register.category,
              timestamp: new Date(),
            });
          }
        }
      } catch (error: any) {
        console.warn(`⚠️  Failed to read ${register.name}: ${error.message}`);
      }
    }

    return values;
  }

  /**
   * Read all discovered devices
   */
  async readAllDevices(): Promise<Map<number, Map<string, any>>> {
    const allData = new Map<number, Map<string, any>>();

    const entries = Array.from(this.discoveredDevices.entries());
    for (const [address, device] of entries) {
      try {
        const data = await this.readDevice(address);
        allData.set(address, data);
        device.status = 'online';
        device.lastSeen = new Date();
      } catch (error: any) {
        console.error(`❌ Failed to read device ${address}: ${error.message}`);
        device.status = 'offline';
      }
    }

    return allData;
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): ModbusDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Check if scanning
   */
  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }
}
