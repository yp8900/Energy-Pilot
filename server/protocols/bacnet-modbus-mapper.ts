/**
 * BACnet-Modbus Mapper
 * Reads Modbus meter configuration from BACnet gateway objects
 * Vendor-independent approach: Uses BACnet objects to discover Modbus meters
 */

import { EventEmitter } from 'events';

/**
 * BACnet Object representing a Modbus meter parameter
 */
export interface BACnetModbusObject {
  deviceId: number;
  objectType: string;           // AI, AV, MSV, etc.
  objectInstance: number;
  objectName: string;           // e.g., "Meter1_ActivePower"
  description?: string;
  presentValue: number | string;
  units?: string;
  
  // Parsed metadata
  meterAddress?: number;        // Extracted from name (e.g., "Meter1" -> address 1)
  meterName?: string;           // Friendly name
  parameterType?: string;       // power, energy, voltage, current, etc.
  phase?: string;               // L1, L2, L3, Total
}

/**
 * Discovered Modbus meter from BACnet objects
 */
export interface DiscoveredMeter {
  address: number;              // Modbus address (if identifiable)
  name: string;                 // Meter name from BACnet objects
  location?: string;
  manufacturer?: string;
  model?: string;
  parameters: BACnetModbusObject[];  // All BACnet objects for this meter
  categories: {
    power: BACnetModbusObject[];
    energy: BACnetModbusObject[];
    voltage: BACnetModbusObject[];
    current: BACnetModbusObject[];
    frequency: BACnetModbusObject[];
    powerFactor: BACnetModbusObject[];
    other: BACnetModbusObject[];
  };
}

/**
 * BACnet-Modbus Mapper Service
 * Discovers Modbus meters by reading BACnet gateway objects
 */
export class BACnetModbusMapper extends EventEmitter {
  private bacnetService: any;
  private discoveredMeters: Map<string, DiscoveredMeter> = new Map();

  constructor(bacnetService: any) {
    super();
    this.bacnetService = bacnetService;
  }

  /**
   * Scan BACnet device for Modbus-related objects
   * @param deviceId - BACnet device ID (e.g., 17800 for Loytec LIOB-589)
   * @param ipAddress - IP address of BACnet device
   */
  async scanForModbusObjects(deviceId: number, ipAddress: string): Promise<DiscoveredMeter[]> {
    console.log(`🔍 Scanning BACnet device ${deviceId} at ${ipAddress} for Modbus objects...`);

    try {
      // Step 1: Get object list from BACnet device
      const objects = await this.readObjectList(deviceId, ipAddress);
      console.log(`   Found ${objects.length} BACnet objects`);

      // Step 2: Read properties for each object
      const objectDetails: BACnetModbusObject[] = [];
      
      for (const obj of objects) {
        try {
          const details = await this.readObjectDetails(deviceId, ipAddress, obj);
          if (details && this.isModbusRelated(details)) {
            objectDetails.push(details);
          }
        } catch (error: any) {
          // Skip objects we can't read
          continue;
        }
      }

      console.log(`   Found ${objectDetails.length} Modbus-related objects`);

      // Step 3: Group objects by meter
      this.discoveredMeters.clear();
      this.groupObjectsByMeter(objectDetails);

      // Step 4: Categorize parameters for each meter
      const meters = Array.from(this.discoveredMeters.values());
      for (const meter of meters) {
        this.categorizeParameters(meter);
      }

      console.log(`✅ Discovered ${meters.length} Modbus meters via BACnet`);
      return meters;

    } catch (error: any) {
      console.error(`❌ Failed to scan for Modbus objects: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read object list from BACnet device
   */
  private async readObjectList(deviceId: number, ipAddress: string): Promise<Array<{type: number, instance: number}>> {
    try {
      const objects = await this.bacnetService.readObjectList(deviceId, ipAddress);
      return objects.map((obj: any) => ({
        type: obj.type,
        instance: obj.instance
      }));
    } catch (error: any) {
      console.error(`❌ Failed to read object list: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read details for a specific BACnet object
   */
  private async readObjectDetails(
    deviceId: number, 
    ipAddress: string, 
    obj: {type: number, instance: number}
  ): Promise<BACnetModbusObject | null> {
    try {
      // Property IDs to read:
      // 77 = object-name
      // 28 = description
      // 85 = present-value
      // 117 = units
      const propertyIds = [77, 28, 85, 117];
      
      const properties = await this.bacnetService.readObjectProperties(
        deviceId,
        ipAddress,
        obj.type,
        obj.instance,
        propertyIds
      );

      const objectName = properties.get(77) || `Object_${obj.instance}`;
      const description = properties.get(28);
      const presentValue = properties.get(85);
      const units = properties.get(117);

      // Map object type number to string
      const objectTypeMap: {[key: number]: string} = {
        0: 'AI',  // Analog Input
        1: 'AO',  // Analog Output
        2: 'AV',  // Analog Value
        3: 'BI',  // Binary Input
        4: 'BO',  // Binary Output
        5: 'BV',  // Binary Value
        13: 'MSI', // Multi-State Input
        14: 'MSO', // Multi-State Output
        19: 'MSV', // Multi-State Value
      };

      return {
        deviceId,
        objectType: objectTypeMap[obj.type] || `Type${obj.type}`,
        objectInstance: obj.instance,
        objectName,
        description,
        presentValue,
        units
      };
    } catch (error: any) {
      // Return null for objects we can't read
      return null;
    }
  }

  /**
   * Check if BACnet object is Modbus-related based on naming convention
   */
  private isModbusRelated(obj: BACnetModbusObject): boolean {
    const name = obj.objectName?.toLowerCase() || '';
    const desc = obj.description?.toLowerCase() || '';
    
    // Common naming patterns for Modbus objects on BACnet gateways:
    const patterns = [
      'modbus',
      'meter',
      'energy',
      'power',
      'current',
      'voltage',
      'kwh',
      'kw',
      'freq',
      'pf',       // power factor
      'thd',      // total harmonic distortion
      'torque',   // VFD torque
      'speed',    // VFD speed
      'rpm',      // VFD rpm
      'motor',    // VFD motor parameters
      'drive',    // VFD drive parameters
      'inverter', // VFD inverter parameters
      'dc',       // DC link voltage
      'hp',       // horsepower
    ];

    return patterns.some(pattern => 
      name.includes(pattern) || desc.includes(pattern)
    );
  }

  /**
   * Group BACnet objects by meter based on naming convention
   * 
   * Strategy:
   * 1. If meter prefix found (Meter1_, EM_01_, VFD1_, etc.) - group by that prefix
   * 2. If no prefix found - group all objects from same BACnet device as ONE meter
   *    (e.g., "INPUT POWER [KW]", "MOTOR VOLTAGE" → single VFD device)
   * 3. Use device ID to ensure separation between different BACnet gateways
   */
  private groupObjectsByMeter(objects: BACnetModbusObject[]): void {
    // Group by device ID first to handle multiple BACnet gateways
    const deviceGroups = new Map<number, BACnetModbusObject[]>();
    
    for (const obj of objects) {
      const deviceId = obj.deviceId;
      if (!deviceGroups.has(deviceId)) {
        deviceGroups.set(deviceId, []);
      }
      deviceGroups.get(deviceId)!.push(obj);
    }

    // Process each device's objects
    for (const [deviceId, deviceObjects] of deviceGroups.entries()) {
      // Separate objects with and without explicit prefixes
      const objectsWithPrefix: BACnetModbusObject[] = [];
      const objectsWithoutPrefix: BACnetModbusObject[] = [];
      
      for (const obj of deviceObjects) {
        const meterInfo = this.extractMeterInfo(obj.objectName);
        if (meterInfo.meterName !== undefined) {
          objectsWithPrefix.push(obj);
        } else {
          objectsWithoutPrefix.push(obj);
        }
      }

      // Handle objects WITH explicit prefixes (Meter1_, EM_01_, VFD1_, etc.)
      for (const obj of objectsWithPrefix) {
        const meterInfo = this.extractMeterInfo(obj.objectName);
        const meterKey = `${deviceId}_${meterInfo.meterName}`;
        this.addObjectToMeter(meterKey, obj, meterInfo);
      }

      // Handle objects WITHOUT prefixes - group as single device
      if (objectsWithoutPrefix.length > 0) {
        const deviceType = this.detectDeviceType(objectsWithoutPrefix);
        const meterKey = `${deviceId}_${deviceType.replace(/\s+/g, '_')}`;
        const meterName = `${deviceType} (Device ${deviceId})`;
        
        for (const obj of objectsWithoutPrefix) {
          const meterInfo = this.extractMeterInfo(obj.objectName);
          this.addObjectToMeter(meterKey, obj, {
            ...meterInfo,
            meterName: meterName,
            address: 0
          });
        }
      }
    }
  }

  /**
   * Detect device type from object names
   * Returns a descriptive name like "VFD", "Energy Meter", "Power Meter", etc.
   */
  private detectDeviceType(objects: BACnetModbusObject[]): string {
    const namesCombined = objects.map(o => o.objectName.toLowerCase()).join(' ');
    
    // Check for VFD/Drive indicators
    if (namesCombined.includes('motor') || namesCombined.includes('frequency') || 
        namesCombined.includes('speed') || namesCombined.includes('torque')) {
      return 'VFD';
    }
    
    // Check for energy meter indicators
    if (namesCombined.includes('kwh') || namesCombined.includes('energy')) {
      return 'Energy Meter';
    }
    
    // Check for power meter indicators
    if (namesCombined.includes('power') && namesCombined.includes('voltage') && namesCombined.includes('current')) {
      return 'Power Meter';
    }
    
    // Default
    return 'Modbus Device';
  }

  /**
   * Add object to meter, creating meter if it doesn't exist
   */
  private addObjectToMeter(
    meterKey: string, 
    obj: BACnetModbusObject, 
    meterInfo: { meterName?: string; address?: number; parameterType?: string; phase?: string }
  ): void {
    let meter = this.discoveredMeters.get(meterKey);
    if (!meter) {
      meter = {
        address: meterInfo.address || 0,
        name: meterInfo.meterName || meterKey,
        parameters: [],
        categories: {
          power: [],
          energy: [],
          voltage: [],
          current: [],
          frequency: [],
          powerFactor: [],
          other: []
        }
      };
      this.discoveredMeters.set(meterKey, meter);
    }

    // Add parsed metadata to object
    obj.meterAddress = meterInfo.address;
    obj.meterName = meterInfo.meterName;
    obj.parameterType = meterInfo.parameterType;
    obj.phase = meterInfo.phase;

    meter.parameters.push(obj);
  }

  /**
   * Extract meter information from object name
   * 
   * Common naming patterns:
   * - "Meter1_ActivePower_Total" → Meter1
   * - "EM_01_Voltage_L1" → EM_01
   * - "Modbus_Addr1_Energy_kWh" → Address_1
   * - "VFD1_MOTOR_VOLTAGE" → VFD1
   * 
   * For objects without clear meter prefix (e.g., "INPUT POWER [KW]", "MOTOR VOLTAGE"),
   * returns undefined meterName to group all as single device
   */
  private extractMeterInfo(objectName: string): {
    meterName?: string;
    address?: number;
    parameterType?: string;
    phase?: string;
  } {
    const name = objectName || '';
    
    // Extract meter identifier (e.g., "Meter1", "EM_01", "Addr1", "VFD1")
    let meterName: string | undefined;
    let address: number | undefined;

    // Pattern 1: Meter1, Meter2, Meter_1, etc.
    const meterMatch = name.match(/^meter[\s_-]*(\d+)/i);
    if (meterMatch) {
      address = parseInt(meterMatch[1]);
      meterName = `Meter${address}`;
      return { meterName, address, ...this.extractParameterInfo(name) };
    }

    // Pattern 2: EM_01, EM01, EM_1, etc.
    const emMatch = name.match(/^em[\s_-]*(\d+)/i);
    if (emMatch) {
      address = parseInt(emMatch[1]);
      meterName = `EM_${String(address).padStart(2, '0')}`;
      return { meterName, address, ...this.extractParameterInfo(name) };
    }

    // Pattern 3: Addr1, Address_1, etc.
    const addrMatch = name.match(/^addr(?:ess)?[\s_-]*(\d+)/i);
    if (addrMatch) {
      address = parseInt(addrMatch[1]);
      meterName = `Address_${address}`;
      return { meterName, address, ...this.extractParameterInfo(name) };
    }

    // Pattern 4: VFD1, VFD_1, Drive1, Drive_1, etc.
    const vfdMatch = name.match(/^(vfd|drive|inverter)[\s_-]*(\d+)/i);
    if (vfdMatch) {
      address = parseInt(vfdMatch[2]);
      meterName = `${vfdMatch[1].toUpperCase()}${address}`;
      return { meterName, address, ...this.extractParameterInfo(name) };
    }

    // Pattern 5: Device1_, Unit1_, etc.
    const deviceMatch = name.match(/^(device|unit|sensor)[\s_-]*(\d+)/i);
    if (deviceMatch) {
      address = parseInt(deviceMatch[2]);
      meterName = `${deviceMatch[1].charAt(0).toUpperCase() + deviceMatch[1].slice(1)}${address}`;
      return { meterName, address, ...this.extractParameterInfo(name) };
    }

    // No clear meter prefix found - return undefined to group all as single device
    // This handles cases like: "INPUT POWER [KW]", "MOTOR VOLTAGE", "FREQUENCY", etc.
    return { meterName: undefined, address: undefined, ...this.extractParameterInfo(name) };
  }

  /**
   * Extract parameter type and phase information from object name
   */
  private extractParameterInfo(name: string): {
    parameterType?: string;
    phase?: string;
  } {
    // Extract parameter type
    let parameterType: string | undefined;
    const nameLower = name.toLowerCase();
    
    // Power types
    if (nameLower.includes('power') && !nameLower.includes('reactive') && !nameLower.includes('apparent')) {
      parameterType = 'active_power';
    } else if (nameLower.includes('reactive')) {
      parameterType = 'reactive_power';
    } else if (nameLower.includes('apparent')) {
      parameterType = 'apparent_power';
    } 
    // Energy
    else if (nameLower.includes('energy') || nameLower.includes('kwh') || nameLower.includes('wh')) {
      parameterType = 'energy';
    } 
    // Voltage
    else if (nameLower.includes('voltage') || nameLower.includes('volt')) {
      parameterType = 'voltage';
    } 
    // Current
    else if (nameLower.includes('current') || nameLower.includes('amp')) {
      parameterType = 'current';
    } 
    // Frequency
    else if (nameLower.includes('freq')) {
      parameterType = 'frequency';
    } 
    // Power Factor
    else if (nameLower.includes('pf') || nameLower.includes('power factor') || nameLower.includes('powerfactor')) {
      parameterType = 'power_factor';
    }
    // VFD-specific parameters
    else if (nameLower.includes('speed') || nameLower.includes('rpm')) {
      parameterType = 'speed';
    } else if (nameLower.includes('torque')) {
      parameterType = 'torque';
    } else if (nameLower.includes('motor')) {
      parameterType = 'motor';
    } else if (nameLower.includes('dc') || nameLower.includes('dc link') || nameLower.includes('dc_link')) {
      parameterType = 'dc_link';
    } else if (nameLower.includes('input')) {
      parameterType = 'input';
    }

    // Extract phase (L1, L2, L3, Total, Average)
    let phase: string | undefined;
    const phaseMatch = name.match(/[_\s-](l[123]|phase[123]|total|avg|average)[_\s-]?/i);
    if (phaseMatch) {
      phase = phaseMatch[1].toUpperCase();
      if (phase.startsWith('PHASE')) {
        phase = 'L' + phase.charAt(5);
      }
    } else if (nameLower.includes('total')) {
      phase = 'TOTAL';
    }

    return { parameterType, phase };
  }

  /**
   * Categorize meter parameters into logical groups
   */
  private categorizeParameters(meter: DiscoveredMeter): void {
    for (const param of meter.parameters) {
      const type = param.parameterType?.toLowerCase() || '';
      const name = param.objectName?.toLowerCase() || '';
      
      if (type.includes('power') && !type.includes('factor')) {
        meter.categories.power.push(param);
      } else if (type.includes('energy')) {
        meter.categories.energy.push(param);
      } else if (type.includes('voltage') || type.includes('dc_link') || name.includes('voltage')) {
        meter.categories.voltage.push(param);
      } else if (type.includes('current') || name.includes('current')) {
        meter.categories.current.push(param);
      } else if (type.includes('frequency') || name.includes('freq')) {
        meter.categories.frequency.push(param);
      } else if (type.includes('factor') || type.includes('pf')) {
        meter.categories.powerFactor.push(param);
      } else {
        // VFD parameters like speed, torque, motor, input, etc.
        meter.categories.other.push(param);
      }
    }
  }

  /**
   * Read current values for all parameters of a discovered meter
   */
  async readMeterValues(meterKey: string): Promise<Map<string, any>> {
    const meter = this.discoveredMeters.get(meterKey);
    if (!meter) {
      throw new Error(`Meter ${meterKey} not found`);
    }

    const values = new Map<string, any>();

    for (const param of meter.parameters) {
      try {
        // Read present-value via BACnet
        // This would use bacnet service to read the property
        const value = await this.readBACnetProperty(
          param.deviceId,
          param.objectType,
          param.objectInstance,
          'present-value'
        );

        values.set(param.objectName, {
          value,
          units: param.units,
          parameterType: param.parameterType,
          phase: param.phase,
          objectInstance: param.objectInstance,
          timestamp: new Date()
        });
      } catch (error: any) {
        console.warn(`⚠️  Failed to read ${param.objectName}: ${error.message}`);
      }
    }

    return values;
  }

  /**
   * Read a specific BACnet property value
   */
  private async readBACnetProperty(
    deviceId: number,
    objectType: string,
    objectInstance: number,
    propertyId: string
  ): Promise<any> {
    // Map object type string to number
    const objectTypeMap: {[key: string]: number} = {
      'AI': 0, 'AO': 1, 'AV': 2,
      'BI': 3, 'BO': 4, 'BV': 5,
      'MSI': 13, 'MSO': 14, 'MSV': 19
    };

    // Map property name to ID
    const propertyIdMap: {[key: string]: number} = {
      'object-name': 77,
      'description': 28,
      'present-value': 85,
      'units': 117
    };

    const objectTypeNum = objectTypeMap[objectType] || 0;
    const propertyIdNum = propertyIdMap[propertyId] || 85;

    // Get device address from bacnet service
    const devices = this.bacnetService.getDiscoveredDevices();
    const device = Array.from(devices.values()).find((d: any) => d.deviceId === deviceId);
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    return await this.bacnetService.readProperty(
      deviceId,
      device.address,
      objectTypeNum,
      objectInstance,
      propertyIdNum
    );
  }

  /**
   * Get all discovered meters
   */
  getDiscoveredMeters(): DiscoveredMeter[] {
    return Array.from(this.discoveredMeters.values());
  }

  /**
   * Get meter by key
   */
  getMeter(meterKey: string): DiscoveredMeter | undefined {
    return this.discoveredMeters.get(meterKey);
  }

  /**
   * Export meter configuration for dashboard
   */
  exportMeterConfigs(): Array<{
    id: string;
    name: string;
    address: number;
    location?: string;
    parameters: Array<{
      name: string;
      type: string;
      phase?: string;
      units?: string;
      bacnetObject: string;
    }>;
  }> {
    const configs: any[] = [];

    for (const [key, meter] of this.discoveredMeters.entries()) {
      configs.push({
        id: key,
        name: meter.name,
        address: meter.address,
        location: meter.location,
        parameters: meter.parameters.map(param => ({
          name: param.objectName,
          type: param.parameterType || 'unknown',
          phase: param.phase,
          units: param.units,
          bacnetObject: `${param.objectType}:${param.objectInstance}`
        }))
      });
    }

    return configs;
  }
}
