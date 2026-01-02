// Base adapter interface for different BMS vendors
export interface BMSAdapter {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  validateSchema(): Promise<boolean>;
  
  // Data fetching methods
  getMeters(): Promise<BMSMeter[]>;
  getRealtimeData(meterId?: string): Promise<BMSReading[]>;
  getAlarms(activeOnly?: boolean): Promise<BMSAlarm[]>;
  getHistoricalData(meterId: string, startTime: Date, endTime: Date): Promise<BMSReading[]>;
  
  // Sync methods
  startSync(intervalMinutes: number): void;
  stopSync(): void;
}

// Standardized data structures
export interface BMSMeter {
  id: string;
  name: string;
  type: string;
  location: string;
  modbusAddress?: number;
  isOnline: boolean;
  lastSeen: Date;
  metadata: Record<string, any>;
}

export interface BMSReading {
  meterId: string;
  timestamp: Date;
  parameters: {
    activePower?: number;
    reactivePower?: number;
    apparentPower?: number;
    energy?: number;
    voltage?: { L1: number; L2: number; L3: number };
    current?: { L1: number; L2: number; L3: number };
    powerFactor?: number;
    frequency?: number;
    thd?: { voltage: number; current: number };
    demand?: { max: number; avg: number };
  };
  quality: 'good' | 'suspect' | 'bad';
}

export interface BMSAlarm {
  id: string;
  meterId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  isActive: boolean;
  acknowledgedBy?: string;
}

// Configuration mapping for different vendor schemas
export interface VendorMapping {
  vendor: string;
  tables: {
    meters: string;
    readings: string;
    alarms: string;
    historical?: string;
  };
  fields: {
    meterId: string;
    meterName: string;
    timestamp: string;
    activePower: string;
    voltage: { L1: string; L2: string; L3: string };
    current: { L1: string; L2: string; L3: string };
    // Add more field mappings as needed
  };
  transformations?: {
    powerUnit: 'W' | 'kW' | 'MW';
    voltageUnit: 'V' | 'kV';
    currentUnit: 'A' | 'kA';
  };
}