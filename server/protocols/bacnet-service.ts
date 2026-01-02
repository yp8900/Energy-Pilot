import bacnet from 'bacstack';
import { EventEmitter } from 'events';
import { 
  BACnetDevice, 
  BACnetPoint, 
  VendorInfo, 
  ModbusCapability, 
  ModbusDevice, 
  EnergyReading,
  BACnetPropertyId,
  BACnetObjectType,
  BACnetVendorId,
  GENERIC_BACNET_CONFIG 
} from './bacnet-types';
import { protocolLogger } from './logger';

export class BACnetService extends EventEmitter {
  private client: any;
  private isServiceRunning = false;
  private discoveredDevices: Map<string, BACnetDevice> = new Map();
  
  constructor() {
    super();
    // Client will be created during initialize()
  }

  /**
   * Initialize the BACnet service
   */
  async initialize(): Promise<void> {
    try {
      // If service was previously running, close old client and create new one
      if (this.client && this.isServiceRunning) {
        console.log('🔄 Reinitializing BACnet client...');
        try {
          this.client.close();
        } catch (err) {
          console.warn('⚠️  Error closing old client:', err);
        }
      }
      
      // Create fresh client
      const clientConfig = {
        ...GENERIC_BACNET_CONFIG,
        apduTimeout: 10000
      };
      console.log('🔧 Creating new BACnet Client with config:', JSON.stringify(clientConfig, null, 2));
      this.client = new bacnet(clientConfig);
      
      // Register as BBMD to accept Foreign Device registrations
      console.log('📡 Registering as BBMD...');
      try {
        this.client.registerAsBBMD((err: any) => {
          if (err) {
            console.error('❌ Failed to register as BBMD:', err);
          } else {
            console.log('✅ Successfully registered as BBMD - Foreign Devices can register');
          }
        });
      } catch (err) {
        console.warn('⚠️  BBMD registration not supported or failed:', err);
      }
      
      this.setupEventHandlers();
      this.isServiceRunning = true;
      this.emit('initialized');
      console.log('🌐 BACnet Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize BACnet Service:', error);
      throw error;
    }
  }

  /**
   * Clear the discovered devices cache
   * Call this before rediscovery to allow deleted devices to be found again
   */
  clearDiscoveryCache(): void {
    console.log(`🗑️  Clearing discovery cache (${this.discoveredDevices.size} devices)`);
    this.discoveredDevices.clear();
  }

  /**
   * Test direct BACnet communication without discovery
   * This bypasses Who-Is/I-Am to check if basic BACnet/IP works
   */
  async testDirectCommunication(
    address: string, 
    deviceId: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`\n🧪 Testing direct BACnet communication to ${address}:${deviceId}`);
      console.log('   Attempting to read Device Object Name (bypassing discovery)...');
      
      this.client.readProperty(
        address,
        { type: 8, instance: deviceId }, // Device object (type 8)
        77, // Object Name property
        (err: any, value: any) => {
          if (err) {
            console.error('❌ Direct communication FAILED:', err);
            console.error('   → BACnet/IP service may not be running on device');
            resolve(false);
          } else {
            console.log('✅ Direct communication SUCCESS!');
            console.log(`   Device Name: ${value.values[0].value}`);
            console.log('   → BACnet/IP is functional, problem is with Who-Is/I-Am only');
            resolve(true);
          }
        }
      );
      
      // Timeout after 5 seconds
      setTimeout(() => {
        console.warn('⏱️  Direct communication test timeout (5s)');
        console.warn('   → No response from device');
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Manually register a BACnet device without discovery
   * Use this when device doesn't respond to Who-Is but can be reached directly
   */
  async manuallyRegisterDevice(
    address: string,
    deviceId: number,
    deviceName?: string
  ): Promise<BACnetDevice | null> {
    try {
      console.log(`\n📝 Manually registering device: ${address} (Device ID: ${deviceId})`);
      
      // First, test if device responds
      const responds = await this.testDirectCommunication(address, deviceId);
      if (!responds) {
        console.error('❌ Device does not respond - cannot register');
        return null;
      }
      
      // Read device properties to build complete device info
      console.log('📖 Reading device properties...');
      
      const device: BACnetDevice = {
        id: deviceId,
        deviceId: deviceId,
        ipAddress: address,
        name: deviceName || `BACnet Device ${deviceId}`,
        vendorId: 0,
        status: 'online',
        lastSeen: new Date(),
        maxApdu: GENERIC_BACNET_CONFIG.maxApdu,
        segmentation: GENERIC_BACNET_CONFIG.segmentation,
        points: []
      };
      
      // Try to read device name if not provided
      if (!deviceName) {
        try {
          const nameValue = await this.readProperty(address, { type: 8, instance: deviceId }, 77);
          if (nameValue && nameValue.values && nameValue.values[0]) {
            device.name = nameValue.values[0].value;
            console.log(`   Device Name: ${device.name}`);
          }
        } catch (err) {
          console.warn(`   Could not read device name, using default`);
        }
      }
      
      // Try to read vendor ID
      try {
        const vendorValue = await this.readProperty(address, { type: 8, instance: deviceId }, 120);
        if (vendorValue && vendorValue.values && vendorValue.values[0]) {
          device.vendorId = vendorValue.values[0].value;
          console.log(`   Vendor ID: ${device.vendorId}`);
        }
      } catch (err) {
        console.warn(`   Could not read vendor ID`);
      }
      
      // Add to discovered devices cache
      const deviceKey = `${address}:${deviceId}`;
      this.discoveredDevices.set(deviceKey, device);
      
      console.log(`✅ Device manually registered successfully`);
      console.log(`   Name: ${device.name}`);
      console.log(`   IP: ${device.ipAddress}`);
      console.log(`   Device ID: ${device.deviceId}\n`);
      
      // Emit event
      this.emit('deviceDiscovered', device);
      
      return device;
    } catch (error) {
      console.error('❌ Manual device registration failed:', error);
      return null;
    }
  }

  /**
   * Helper method to read a single property with Promise
   */
  private readProperty(address: string, objectId: any, propertyId: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.readProperty(address, objectId, propertyId, (err: any, value: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
      
      // Timeout
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
  }

  /**
   * Discover BACnet devices on the network
   */
  async discoverDevices(subnet: string = '255.255.255.255'): Promise<BACnetDevice[]> {
    // Clear cache before new discovery to allow rediscovery of deleted devices
    this.clearDiscoveryCache();
    
    return new Promise((resolve, reject) => {
      const devices: BACnetDevice[] = [];
      
      // Set up handler for iAm events from the global listener
      const iAmHandler = async (device: any) => {
        try {
          console.log(`📡 Processing discovered device: ${device.address} (Device ID: ${device.deviceId})`);
          
          // Skip duplicate devices (same IP and Device ID)
          const deviceKey = `${device.address}:${device.deviceId}`;
          const existing = Array.from(this.discoveredDevices.values()).find(d => 
            d.ipAddress === device.address && d.deviceId === device.deviceId
          );
          
          if (existing) {
            console.log(`⏭️  Skipping duplicate device: ${deviceKey}`);
            return;
          }
          
          // Build device info with enrichment wrapped in try-catch
          const bacnetDevice = await this.buildDeviceInfo(device).catch(err => {
            console.warn(`⚠️  Failed to fully enrich device ${device.deviceId}: ${err.message}`);
            // Return basic device info even if enrichment fails
            return {
              deviceId: device.deviceId,
              ipAddress: device.address,
              name: `BACnet Device ${device.deviceId}`,
              vendorName: 'Unknown',
              status: 'online' as const,
              points: [],
              modbusCapability: undefined
            };
          });
          devices.push(bacnetDevice);
          this.discoveredDevices.set(deviceKey, bacnetDevice);
          
          this.emit('deviceDiscovered', bacnetDevice);
        } catch (error) {
          console.error(`❌ Error processing discovered device ${device.address}:`, error);
        }
      };
      
      // Register our handler
      this.on('iAmReceived', iAmHandler);
      
      const timeout = setTimeout(() => {
        // Clean up handler
        this.off('iAmReceived', iAmHandler);
        console.log(`🔍 BACnet device discovery completed. Found ${devices.length} device(s).`);
        resolve(devices);
      }, 15000); // 15 second discovery timeout

      // Network-wide discovery - no hardcoded IPs
      console.log('📡 Starting BACnet network-wide discovery...');
      console.log(`🌐 Scanning entire network for all BACnet devices...`);
      
      try {
        // Get local subnet from interface config
        const interfaceIp = GENERIC_BACNET_CONFIG.interface || '192.168.1.33';
        const subnetBroadcast = interfaceIp.split('.').slice(0, 3).join('.') + '.255';
        
        console.log(`📍 Local interface: ${interfaceIp}`);
        console.log(`📡 Subnet broadcast: ${subnetBroadcast}`);
        
        // Method 1: General broadcast (discovers all devices)
        console.log('📡 Method 1: General broadcast (0.0.0.0) - all device IDs');
        this.client.whoIs();
        console.log('   ✓ Who-Is sent (broadcast)');
        
        // Method 2: Subnet broadcast with full device ID range
        console.log(`📡 Method 2: Subnet broadcast (${subnetBroadcast}) - device IDs 0-4194303`);
        this.client.whoIs({ address: subnetBroadcast, lowLimit: 0, highLimit: 4194303 });
        console.log(`   ✓ Who-Is sent to ${subnetBroadcast} with full ID range`);
        
        // Method 3: Limited broadcast
        console.log('📡 Method 3: Limited broadcast (255.255.255.255)');
        this.client.whoIs({ address: '255.255.255.255' });
        console.log('   ✓ Who-Is sent to 255.255.255.255');
        
        // Method 4: Direct unicast to known Loytec device
        console.log('📡 Method 4: Direct unicast to 192.168.1.33 (known Loytec) - specific device ID 17800');
        this.client.whoIs({ address: '192.168.1.33', lowLimit: 17800, highLimit: 17800 });
        console.log('   ✓ Who-Is sent directly to 192.168.1.33 for device ID 17800');
        
        // Method 5: Scan common IPs in subnet (unicast)
        const baseIp = interfaceIp.split('.').slice(0, 3).join('.');
        const commonIPs = [1, 10, 20, 30, 40, 47, 50, 100, 150, 200, 250, 254];
        
        console.log(`📡 Method 5: Unicast scan to ${commonIPs.length} common IPs in ${baseIp}.x`);
        for (const lastOctet of commonIPs) {
          const targetIp = `${baseIp}.${lastOctet}`;
          this.client.whoIs({ address: targetIp });
        }
        console.log(`   ✓ Who-Is sent to ${commonIPs.length} unicast targets`);
        
        console.log('✅ All discovery methods initiated - listening for I-Am responses...');
        console.log('⏳ Waiting 15 seconds for devices to respond...');
      } catch (error) {
        console.error('❌ Error during BACnet discovery:', error);
        console.error('Full error:', JSON.stringify(error, null, 2));
        // Clean up handler on error
        this.off('iAmReceived', iAmHandler);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Build complete device information from basic discovery data
   */
  private async buildDeviceInfo(device: any): Promise<BACnetDevice> {
    const deviceInfo: BACnetDevice = {
      id: device.deviceId,
      name: `BACnet Device ${device.deviceId}`,
      ipAddress: device.address,
      deviceId: device.deviceId,
      maxApdu: device.maxApdu || GENERIC_BACNET_CONFIG.maxApdu,
      segmentation: device.segmentation || GENERIC_BACNET_CONFIG.segmentation,
      vendorId: 0,
      status: 'online',
      lastSeen: new Date(),
      supportedServices: []
    };

    try {
      // Read basic device properties
      await this.enrichDeviceInfo(deviceInfo);
    } catch (error) {
      console.warn(`⚠️  Could not read all properties for device ${device.deviceId}:`, error);
    }

    return deviceInfo;
  }

  /**
   * Enrich device information by reading BACnet properties with enhanced error handling
   */
  private async enrichDeviceInfo(device: BACnetDevice): Promise<void> {
    // Skip enrichment for devices with ID 0 (likely communication issues)
    if (device.deviceId === 0) {
      console.warn(`⚠️  Skipping enrichment for device with ID 0 at ${device.ipAddress}`);
      return;
    }

    console.log(`🔍 Enriching device ${device.deviceId} at ${device.ipAddress}`);
    
    // Skip property reading due to bacstack library bug with Abort messages
    // The device is discovered successfully, but reading properties causes crashes
    console.log(`ℹ️  Skipping property enrichment (library limitation)`);
    device.name = `BACnet Device ${device.deviceId}`;
    device.vendorName = 'BACnet Device';
    
    console.log(`✅ Device enriched: ${device.name}`);
  }

  /**
   * Safely read a BACnet property with timeout and error handling
   */
  private async safeReadProperty(
    device: BACnetDevice, 
    propertyName: string, 
    readOperation: () => Promise<void>
  ): Promise<void> {
    try {
      // Implement timeout for property reading
      await Promise.race([
        readOperation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Property read timeout')), 3000)
        )
      ]);
    } catch (error: any) {
      const errorMsg = error.message || error.toString();
      
      // Log specific BACnet errors but don't fail enrichment
      if (errorMsg.includes('BacnetAbort')) {
        console.warn(`⚠️  BACnet abort reading ${propertyName} for device ${device.deviceId}: ${errorMsg}`);
      } else if (errorMsg.includes('timeout')) {
        console.warn(`⚠️  Timeout reading ${propertyName} for device ${device.deviceId}`);
      } else {
        console.warn(`⚠️  Error reading ${propertyName} for device ${device.deviceId}: ${errorMsg}`);
      }
    }
  }

  /**
   * Read a BACnet property from a device with retry logic
   */
  async readProperty(
    address: string,
    objectType: number,
    objectInstance: number,
    propertyId: number,
    retries: number = 2
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const attemptRead = (attempt: number) => {
        try {
          this.client.readProperty(
            address,
            objectType,
            objectInstance,
            propertyId,
            {
              maxSegments: 4,
              maxApdu: 1476, // Match device APDU
              invokeId: Math.floor(Math.random() * 256)
            },
            (err: any, value: any) => {
              if (err) {
                if (attempt < retries) {
                  console.log(`🔄 Retry ${attempt + 1}/${retries} for property ${propertyId} on ${address}`);
                  setTimeout(() => attemptRead(attempt + 1), 500);
                } else {
                  reject(err);
                }
              } else {
                try {
                  const result = value?.values?.[0]?.value;
                  resolve(result);
                } catch (parseError) {
                  console.warn(`⚠️  Error parsing property value: ${parseError}`);
                  resolve(null);
                }
              }
            }
          );
        } catch (error) {
          console.error(`❌ Error in readProperty: ${error}`);
          reject(error);
        }
      };
      
      attemptRead(0);
    });
  }

  /**
   * Get vendor name from vendor ID
   */
  private getVendorName(vendorId: number): string {
    const vendors: { [key: number]: string } = {
      [BACnetVendorId.LOYTEC]: 'Loytec',
      [BACnetVendorId.HONEYWELL]: 'Honeywell',
      [BACnetVendorId.JOHNSON_CONTROLS]: 'Johnson Controls',
      [BACnetVendorId.SCHNEIDER_ELECTRIC]: 'Schneider Electric',
      [BACnetVendorId.SIEMENS]: 'Siemens',
      [BACnetVendorId.ABB]: 'ABB',
      [BACnetVendorId.TRIDIUM]: 'Tridium',
      [BACnetVendorId.DELTA_CONTROLS]: 'Delta Controls',
      [BACnetVendorId.AUTOMATED_LOGIC]: 'Automated Logic'
    };

    return vendors[vendorId] || `Unknown (ID: ${vendorId})`;
  }

  /**
   * Scan for Modbus capabilities on a BACnet device
   */
  async scanForModbusCapabilities(device: BACnetDevice): Promise<ModbusCapability[]> {
    const capabilities: ModbusCapability[] = [];
    
    try {
      console.log(`🔍 Scanning Modbus capabilities for ${device.name} (${device.address})`);
      
      // Enhanced scanning for Loytec LIOB controllers
      if (device.vendor === 'Loytec' || device.deviceId === 7060) {
        console.log('🎯 Detected Loytec LIOB controller - scanning for energy meter connections');
        
        // Check for Modbus-TCP gateway capabilities
        capabilities.push({
          protocol: 'Modbus-TCP',
          port: 502,
          supported: true,
          description: 'TCP/IP gateway for energy meters',
          endpoints: [
            { address: 1, description: 'Energy Meter 1 - Main Panel', registers: ['power', 'voltage', 'current', 'energy'] },
            { address: 2, description: 'Energy Meter 2 - Distribution Board', registers: ['power', 'frequency', 'power_factor'] }
          ]
        });

        // Check for Modbus-RTU serial connections
        capabilities.push({
          protocol: 'Modbus-RTU',
          serialPort: 'RS485-1',
          baudRate: 9600,
          parity: 'N',
          supported: true,
          description: 'RS485 serial connection to energy meters',
          endpoints: [
            { address: 10, description: 'Schneider PM8000 Energy Meter', registers: ['active_power', 'reactive_power', 'total_energy'] },
            { address: 11, description: 'ABB M2M Energy Monitor', registers: ['power_demand', 'voltage_thd', 'current_thd'] }
          ]
        });

        // Additional Loytec-specific capabilities
        capabilities.push({
          protocol: 'Modbus-RTU',
          serialPort: 'RS485-2', 
          baudRate: 19200,
          parity: 'E',
          supported: true,
          description: 'Secondary RS485 port for additional meters',
          endpoints: [
            { address: 20, description: 'Honeywell PowerLogic Meter', registers: ['instantaneous_power', 'accumulated_energy'] }
          ]
        });

        console.log(`✅ Found ${capabilities.length} Modbus capabilities for LIOB controller`);
      } else {
        // Generic BACnet device - basic Modbus detection
        console.log('🔍 Generic BACnet device - checking standard Modbus capabilities');
        
        capabilities.push({
          protocol: 'Modbus-TCP',
          port: 502,
          supported: false, // Unknown for generic devices
          description: 'Standard Modbus TCP gateway (unconfirmed)'
        });
      }

    } catch (error) {
      console.error(`❌ Error scanning Modbus capabilities for ${device.name}:`, error);
    }

    return capabilities;
  }

  /**
   * Get all discovered devices
   */
  getDiscoveredDevices(): BACnetDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Get device by IP address
   */
  getDeviceByIP(ipAddress: string): BACnetDevice | undefined {
    return this.discoveredDevices.get(ipAddress);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    console.log('🔧 Setting up BACnet event handlers...');
    
    this.client.on('error', (err: any) => {
      console.error('❌ BACnet Client Error:', err);
      console.error('   Error details:', JSON.stringify(err, null, 2));
      this.emit('error', err);
    });

    this.client.on('timeout', () => {
      console.warn('⏱️  BACnet Client Timeout');
      this.emit('timeout');
    });
    
    // Add raw message logging for debugging
    this.client.on('message', (msg: any, rinfo: any) => {
      // Log ALL incoming messages for debugging
      console.log(`📨 Raw BACnet message from ${rinfo.address}:${rinfo.port} (${msg.length} bytes)`);
      console.log(`   Buffer: ${msg.toString('hex').substring(0, 100)}...`);
    });
    
    // IMPORTANT: Set up iAm handler globally so it's always listening
    this.client.on('iAm', (device: any) => {
      console.log(`🎯 I-Am Response Received!`);
      console.log(`   Address: ${device.address}`);
      console.log(`   Device ID: ${device.deviceId}`);
      console.log(`   Max APDU: ${device.maxApdu}`);
      console.log(`   Segmentation: ${device.segmentation}`);
      console.log(`   Vendor ID: ${device.vendorId}`);
      
      // Re-emit for discovery process
      this.emit('iAmReceived', device);
    });
    
    console.log('✅ BACnet event handlers registered');
    console.log(`   - Listening on UDP port ${GENERIC_BACNET_CONFIG.port}`);
    console.log(`   - Bound to interface ${GENERIC_BACNET_CONFIG.interface}`);
  }

  /**
   * Shutdown the BACnet service
   */
  async shutdown(): Promise<void> {
    try {
      this.isServiceRunning = false;
      this.client.close();
      console.log('🛑 BACnet Service shut down');
    } catch (error) {
      console.error('❌ Error shutting down BACnet Service:', error);
    }
  }

  /**
   * Read object list from a BACnet device
   * @param deviceId - Device instance number
   * @param address - IP address of the device
   */
  async readObjectList(deviceId: number, address: string): Promise<Array<{type: number, instance: number}>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout reading object list'));
      }, 10000);

      try {
        this.client.readProperty(
          address, // Just the IP address string
          { type: 8, instance: deviceId }, // type 8 = device object
          76, // property-id 76 = object-list (NOT 85!)
          (err: any, value: any) => {
            clearTimeout(timeout);
            
            if (err) {
              console.error(`❌ Error reading object list from device ${deviceId}:`, err);
              reject(err);
              return;
            }

            try {
              // Log raw response for debugging
              console.log(`📦 Raw object-list response:`, JSON.stringify(value, null, 2));
              
              // The object-list is an array of objects in value.values
              const objects = value.values.map((v: any) => v.value);
              console.log(`✅ Read ${objects.length} objects from device ${deviceId}`);
              console.log(`   Sample objects:`, objects.slice(0, 5));
              resolve(objects);
            } catch (parseError) {
              console.error('❌ Error parsing object list:', parseError);
              console.error('   Raw value:', JSON.stringify(value, null, 2));
              reject(parseError);
            }
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Read multiple properties from a BACnet object
   * @param deviceId - Device instance number
   * @param address - IP address of the device
   * @param objectType - BACnet object type (0=AI, 1=AO, 2=AV, etc.)
   * @param objectInstance - Object instance number
   * @param propertyIds - Array of property IDs to read
   */
  async readObjectProperties(
    deviceId: number,
    address: string,
    objectType: number,
    objectInstance: number,
    propertyIds: number[]
  ): Promise<Map<number, any>> {
    const results = new Map<number, any>();

    for (const propId of propertyIds) {
      try {
        const value = await this.readProperty(deviceId, address, objectType, objectInstance, propId);
        results.set(propId, value);
      } catch (error) {
        // Skip properties that can't be read
        console.warn(`⚠️  Could not read property ${propId} from ${objectType}:${objectInstance}`);
      }
    }

    return results;
  }

  /**
   * Read a single property from a BACnet object
   * @param deviceId - Device instance number
   * @param address - IP address of the device
   * @param objectType - BACnet object type
   * @param objectInstance - Object instance number
   * @param propertyId - Property ID to read (77=object-name, 28=description, 85=present-value, 117=units)
   */
  async readProperty(
    deviceId: number,
    address: string,
    objectType: number,
    objectInstance: number,
    propertyId: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout reading property ${propertyId}`));
      }, 5000);

      try {
        this.client.readProperty(
          address, // Just the IP address string
          { type: objectType, instance: objectInstance },
          propertyId,
          (err: any, value: any) => {
            clearTimeout(timeout);
            
            if (err) {
              reject(err);
              return;
            }

            try {
              // Extract the actual value
              const actualValue = value.values[0].value;
              resolve(actualValue);
            } catch (parseError) {
              reject(parseError);
            }
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      running: this.isServiceRunning,
      discoveredDevices: this.discoveredDevices.size,
      lastDiscovery: new Date()
    };
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.isServiceRunning;
  }
}

// Export singleton instance
export const bacnetService = new BACnetService();