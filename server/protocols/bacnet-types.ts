// BACnet Protocol Type Definitions for EnCharge

export interface BACnetDevice {
  id: number;
  name: string;
  ipAddress: string;
  deviceId: number;
  maxApdu: number;
  segmentation: number;
  vendorId: number;
  vendorName?: string;
  modelNumber?: string;
  firmwareVersion?: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  supportedServices: string[];
}

export interface BACnetPoint {
  objectType: number;
  objectInstance: number;
  propertyId: number;
  description: string;
  unit: string;
  value?: any;
  timestamp?: Date;
  quality?: 'good' | 'bad' | 'uncertain';
}

export interface VendorInfo {
  vendorId: number;
  vendorName: string; // 'Loytec', 'Honeywell', 'Johnson Controls', etc.
  modelNumber?: string;
  firmwareVersion?: string;
  supportedProtocols: string[]; // ['BACnet', 'Modbus-TCP', 'Modbus-RTU']
}

export interface ModbusCapability {
  protocol: 'Modbus-TCP' | 'Modbus-RTU';
  port?: number; // For Modbus TCP
  serialPort?: string; // For Modbus RTU
  baudRate?: number;
  parity?: 'N' | 'E' | 'O';
  supported: boolean;
  description?: string; // Human-readable description
  endpoints?: ModbusEndpoint[]; // Connected devices
}

export interface ModbusEndpoint {
  address: number; // Modbus slave address (1-247)
  description: string; // Device description
  registers?: string[]; // Available data registers
}

export interface ModbusDevice {
  bacnetControllerId: number;
  modbusAddress: number; // 1-247
  deviceType: string; // 'energy_meter', 'power_meter'
  manufacturer: string; // Auto-detected: 'Schneider', 'ABB', 'Socomec'
  model: string; // Auto-detected: 'PM5340', 'A44', etc.
  registerMap: ModbusRegisterMap;
  detectedVia: string; // 'BACnet-object-scan', 'Modbus-discovery'
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
}

export interface ModbusRegisterMap {
  [parameter: string]: {
    registerAddress: number;
    dataType: 'HOLDING' | 'INPUT' | 'COIL' | 'DISCRETE';
    scaleFactor: number;
    unit: string;
  };
}

export interface EnergyReading {
  deviceId: number;
  timestamp: Date;
  power: number; // kW
  energy: number; // kWh
  voltage: number; // V
  current: number; // A
  frequency: number; // Hz
  powerFactor: number;
  quality: 'good' | 'bad' | 'uncertain';
  source: 'BACnet' | 'Modbus' | 'BMS-Database';
}

// BACnet Property IDs (common ones)
export enum BACnetPropertyId {
  OBJECT_IDENTIFIER = 75,
  OBJECT_NAME = 77,
  OBJECT_TYPE = 79,
  PRESENT_VALUE = 85,
  DESCRIPTION = 28,
  DEVICE_ADDRESS_BINDING = 30,
  DATABASE_REVISION = 155,
  SEGMENTATION_SUPPORTED = 107,
  VENDOR_IDENTIFIER = 120,
  VENDOR_NAME = 121,
  MODEL_NAME = 70,
  FIRMWARE_REVISION = 44,
  APPLICATION_SOFTWARE_VERSION = 12,
  PROTOCOL_SERVICES_SUPPORTED = 97,
  OBJECT_LIST = 76
}

// BACnet Object Types (common ones)
export enum BACnetObjectType {
  ANALOG_INPUT = 0,
  ANALOG_OUTPUT = 1,
  ANALOG_VALUE = 2,
  BINARY_INPUT = 3,
  BINARY_OUTPUT = 4,
  BINARY_VALUE = 5,
  DEVICE = 8,
  FILE = 10,
  MULTI_STATE_INPUT = 13,
  MULTI_STATE_OUTPUT = 14,
  MULTI_STATE_VALUE = 19
}

// Known Vendor IDs
export enum BACnetVendorId {
  LOYTEC = 65,
  HONEYWELL = 5,
  JOHNSON_CONTROLS = 15,
  SCHNEIDER_ELECTRIC = 10,
  SIEMENS = 155,
  ABB = 18,
  TRIDIUM = 148,
  DELTA_CONTROLS = 16,
  AUTOMATED_LOGIC = 142
}

// Generic BACnet configuration with enhanced network compatibility
export const GENERIC_BACNET_CONFIG = {
  vendorId: null, // Auto-detect from device
  segmentation: 3, // Both segmentation (standard)
  maxApdu: 1476, // Standard APDU length
  port: 47808,
  timeout: 6000, // 6 second timeout for requests
  retry: 1, // Single retry to avoid flooding
  supportedServices: [
    'readProperty',
    'readPropertyMultiple',
    'writeProperty',
    'subscribeCOV'
  ],
  // Network interface - Updated to match your current IP
  interface: process.env.BACNET_INTERFACE || '192.168.1.42', 
  reuseAddr: true, // Allow socket reuse
  broadcastAddress: process.env.BACNET_BROADCAST || '192.168.1.255' // Subnet broadcast
};