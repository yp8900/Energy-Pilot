/**
 * Energy Meter Definitions and Register Maps
 * Comprehensive register maps for various energy meter manufacturers
 */

/**
 * Data type definitions for Modbus registers
 */
export type ModbusDataType = 
  | 'uint16'      // Unsigned 16-bit integer (1 register)
  | 'int16'       // Signed 16-bit integer (1 register)
  | 'uint32'      // Unsigned 32-bit integer (2 registers)
  | 'int32'       // Signed 32-bit integer (2 registers)
  | 'float32'     // 32-bit IEEE 754 float (2 registers)
  | 'float64'     // 64-bit IEEE 754 float (4 registers)
  | 'string';     // ASCII string (multiple registers)

/**
 * Byte order for multi-register values
 */
export type ByteOrder = 
  | 'BE'          // Big Endian (ABCD)
  | 'LE'          // Little Endian (DCBA)
  | 'BE_SWAP'     // Big Endian Byte Swap (BADC)
  | 'LE_SWAP';    // Little Endian Byte Swap (CDAB)

/**
 * Register definition with complete metadata
 */
export interface MeterRegister {
  address: number;
  name: string;
  description: string;
  type: 'holding' | 'input' | 'coil' | 'discrete';
  dataType: ModbusDataType;
  byteOrder?: ByteOrder;
  unit: string;
  scale: number;          // Multiplier for the raw value
  offset?: number;        // Offset to add after scaling
  decimals?: number;      // Number of decimal places to display
  writable?: boolean;     // Can this register be written to?
  category: 'power' | 'energy' | 'voltage' | 'current' | 'frequency' | 'power_factor' | 'demand' | 'harmonics' | 'status' | 'config';
}

/**
 * Meter model definition with complete register map
 */
export interface MeterDefinition {
  manufacturer: string;
  model: string;
  description: string;
  baudRate?: number[];            // Supported baud rates
  defaultBaudRate?: number;
  parity?: ('none' | 'even' | 'odd')[];
  defaultParity?: 'none' | 'even' | 'odd';
  defaultByteOrder?: ByteOrder;
  identificationMethod: {
    register: number;
    type: 'holding' | 'input';
    expectedValue?: number | string;
    mask?: number;
  };
  registers: MeterRegister[];
}

/**
 * Standard IEC 61850 / Modbus Energy Meter Registers
 * Used as fallback for generic meters
 */
export const GENERIC_ENERGY_METER: MeterDefinition = {
  manufacturer: 'Generic',
  model: 'IEC 61850 Standard',
  description: 'Standard IEC 61850 Modbus register layout',
  baudRate: [9600, 19200, 38400],
  defaultBaudRate: 9600,
  parity: ['none', 'even'],
  defaultParity: 'even',
  defaultByteOrder: 'BE',
  identificationMethod: {
    register: 0,
    type: 'holding',
  },
  registers: [
    // **Power Measurements**
    {
      address: 0,
      name: 'total_active_power',
      description: 'Total Active Power (3-phase sum)',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kW',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 2,
      name: 'total_reactive_power',
      description: 'Total Reactive Power (3-phase sum)',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVAr',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 4,
      name: 'total_apparent_power',
      description: 'Total Apparent Power (3-phase sum)',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVA',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 6,
      name: 'l1_active_power',
      description: 'Phase L1 Active Power',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kW',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 8,
      name: 'l2_active_power',
      description: 'Phase L2 Active Power',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kW',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 10,
      name: 'l3_active_power',
      description: 'Phase L3 Active Power',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kW',
      scale: 1,
      decimals: 2,
      category: 'power'
    },

    // **Energy Measurements**
    {
      address: 100,
      name: 'total_active_energy',
      description: 'Total Accumulated Active Energy',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kWh',
      scale: 1,
      decimals: 2,
      category: 'energy'
    },
    {
      address: 102,
      name: 'total_reactive_energy',
      description: 'Total Accumulated Reactive Energy',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVArh',
      scale: 1,
      decimals: 2,
      category: 'energy'
    },
    {
      address: 104,
      name: 'total_apparent_energy',
      description: 'Total Accumulated Apparent Energy',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVAh',
      scale: 1,
      decimals: 2,
      category: 'energy'
    },

    // **Voltage Measurements (Phase-to-Neutral)**
    {
      address: 200,
      name: 'voltage_l1_n',
      description: 'Voltage Phase L1 to Neutral',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 202,
      name: 'voltage_l2_n',
      description: 'Voltage Phase L2 to Neutral',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 204,
      name: 'voltage_l3_n',
      description: 'Voltage Phase L3 to Neutral',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },

    // **Voltage Measurements (Phase-to-Phase)**
    {
      address: 210,
      name: 'voltage_l1_l2',
      description: 'Voltage Phase L1 to L2',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 212,
      name: 'voltage_l2_l3',
      description: 'Voltage Phase L2 to L3',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 214,
      name: 'voltage_l3_l1',
      description: 'Voltage Phase L3 to L1',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },

    // **Current Measurements**
    {
      address: 300,
      name: 'current_l1',
      description: 'Current Phase L1',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },
    {
      address: 302,
      name: 'current_l2',
      description: 'Current Phase L2',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },
    {
      address: 304,
      name: 'current_l3',
      description: 'Current Phase L3',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },
    {
      address: 306,
      name: 'current_neutral',
      description: 'Neutral Current',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },

    // **Power Factor**
    {
      address: 400,
      name: 'total_power_factor',
      description: 'Total Power Factor',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: '',
      scale: 1,
      decimals: 3,
      category: 'power_factor'
    },
    {
      address: 402,
      name: 'l1_power_factor',
      description: 'Phase L1 Power Factor',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: '',
      scale: 1,
      decimals: 3,
      category: 'power_factor'
    },
    {
      address: 404,
      name: 'l2_power_factor',
      description: 'Phase L2 Power Factor',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: '',
      scale: 1,
      decimals: 3,
      category: 'power_factor'
    },
    {
      address: 406,
      name: 'l3_power_factor',
      description: 'Phase L3 Power Factor',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: '',
      scale: 1,
      decimals: 3,
      category: 'power_factor'
    },

    // **Frequency**
    {
      address: 500,
      name: 'frequency',
      description: 'System Frequency',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'Hz',
      scale: 1,
      decimals: 2,
      category: 'frequency'
    },

    // **Demand (Maximum Demand)**
    {
      address: 600,
      name: 'max_demand_active_power',
      description: 'Maximum Demand Active Power',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kW',
      scale: 1,
      decimals: 2,
      category: 'demand'
    },
  ]
};

/**
 * Schneider Electric PowerLogic PM8000 Series
 */
export const SCHNEIDER_PM8000: MeterDefinition = {
  manufacturer: 'Schneider Electric',
  model: 'PM8000 Series',
  description: 'PowerLogic PM8000 Series Power Meter',
  baudRate: [9600, 19200, 38400, 57600, 115200],
  defaultBaudRate: 19200,
  parity: ['none', 'even', 'odd'],
  defaultParity: 'even',
  defaultByteOrder: 'BE',
  identificationMethod: {
    register: 129,
    type: 'holding',
    expectedValue: 0x504D, // 'PM' in ASCII
  },
  registers: [
    // Power (addresses 2999-3026)
    {
      address: 2999,
      name: 'total_active_power',
      description: 'Total Active Power',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kW',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 3001,
      name: 'total_reactive_power',
      description: 'Total Reactive Power',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVAr',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 3003,
      name: 'total_apparent_power',
      description: 'Total Apparent Power',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVA',
      scale: 1,
      decimals: 2,
      category: 'power'
    },

    // Energy (addresses 2699-2710)
    {
      address: 2699,
      name: 'total_active_energy',
      description: 'Total Active Energy',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kWh',
      scale: 1,
      decimals: 2,
      category: 'energy'
    },
    {
      address: 2701,
      name: 'total_reactive_energy',
      description: 'Total Reactive Energy',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVArh',
      scale: 1,
      decimals: 2,
      category: 'energy'
    },

    // Voltage (addresses 3027-3044)
    {
      address: 3027,
      name: 'voltage_l1_n',
      description: 'Phase L1-N Voltage',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 3029,
      name: 'voltage_l2_n',
      description: 'Phase L2-N Voltage',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 3031,
      name: 'voltage_l3_n',
      description: 'Phase L3-N Voltage',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 3019,
      name: 'voltage_l1_l2',
      description: 'Line L1-L2 Voltage',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 3021,
      name: 'voltage_l2_l3',
      description: 'Line L2-L3 Voltage',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 3023,
      name: 'voltage_l3_l1',
      description: 'Line L3-L1 Voltage',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },

    // Current (addresses 2999-3010)
    {
      address: 2999,
      name: 'current_l1',
      description: 'Phase L1 Current',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },
    {
      address: 3001,
      name: 'current_l2',
      description: 'Phase L2 Current',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },
    {
      address: 3003,
      name: 'current_l3',
      description: 'Phase L3 Current',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },

    // Power Factor (addresses 3077-3086)
    {
      address: 3077,
      name: 'total_power_factor',
      description: 'Total Power Factor',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: '',
      scale: 1,
      decimals: 3,
      category: 'power_factor'
    },

    // Frequency (address 3109)
    {
      address: 3109,
      name: 'frequency',
      description: 'System Frequency',
      type: 'input',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'Hz',
      scale: 1,
      decimals: 2,
      category: 'frequency'
    },
  ]
};

/**
 * ABB M2M/M4M Energy Meters
 */
export const ABB_M2M: MeterDefinition = {
  manufacturer: 'ABB',
  model: 'M2M/M4M',
  description: 'ABB M2M/M4M Energy Meter',
  baudRate: [9600, 19200, 38400, 57600, 115200],
  defaultBaudRate: 9600,
  parity: ['none', 'even'],
  defaultParity: 'even',
  defaultByteOrder: 'BE',
  identificationMethod: {
    register: 0xF000,
    type: 'holding',
    expectedValue: 0x00AB,
  },
  registers: [
    // Power
    {
      address: 0x5000,
      name: 'total_active_power',
      description: 'Total Active Power',
      type: 'holding',
      dataType: 'int32',
      byteOrder: 'BE',
      unit: 'kW',
      scale: 0.001,
      decimals: 2,
      category: 'power'
    },
    {
      address: 0x5002,
      name: 'total_reactive_power',
      description: 'Total Reactive Power',
      type: 'holding',
      dataType: 'int32',
      byteOrder: 'BE',
      unit: 'kVAr',
      scale: 0.001,
      decimals: 2,
      category: 'power'
    },
    {
      address: 0x5004,
      name: 'total_apparent_power',
      description: 'Total Apparent Power',
      type: 'holding',
      dataType: 'int32',
      byteOrder: 'BE',
      unit: 'kVA',
      scale: 0.001,
      decimals: 2,
      category: 'power'
    },

    // Energy
    {
      address: 0x6000,
      name: 'total_active_energy',
      description: 'Total Active Energy',
      type: 'holding',
      dataType: 'int32',
      byteOrder: 'BE',
      unit: 'kWh',
      scale: 0.01,
      decimals: 2,
      category: 'energy'
    },
    {
      address: 0x6002,
      name: 'total_reactive_energy',
      description: 'Total Reactive Energy',
      type: 'holding',
      dataType: 'int32',
      byteOrder: 'BE',
      unit: 'kVArh',
      scale: 0.01,
      decimals: 2,
      category: 'energy'
    },

    // Voltage
    {
      address: 0x5B00,
      name: 'voltage_l1_n',
      description: 'Phase L1-N Voltage',
      type: 'holding',
      dataType: 'uint16',
      unit: 'V',
      scale: 0.1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 0x5B01,
      name: 'voltage_l2_n',
      description: 'Phase L2-N Voltage',
      type: 'holding',
      dataType: 'uint16',
      unit: 'V',
      scale: 0.1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 0x5B02,
      name: 'voltage_l3_n',
      description: 'Phase L3-N Voltage',
      type: 'holding',
      dataType: 'uint16',
      unit: 'V',
      scale: 0.1,
      decimals: 1,
      category: 'voltage'
    },

    // Current
    {
      address: 0x5B0C,
      name: 'current_l1',
      description: 'Phase L1 Current',
      type: 'holding',
      dataType: 'uint32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 0.001,
      decimals: 2,
      category: 'current'
    },
    {
      address: 0x5B0E,
      name: 'current_l2',
      description: 'Phase L2 Current',
      type: 'holding',
      dataType: 'uint32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 0.001,
      decimals: 2,
      category: 'current'
    },
    {
      address: 0x5B10,
      name: 'current_l3',
      description: 'Phase L3 Current',
      type: 'holding',
      dataType: 'uint32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 0.001,
      decimals: 2,
      category: 'current'
    },

    // Power Factor
    {
      address: 0x5B3C,
      name: 'total_power_factor',
      description: 'Total Power Factor',
      type: 'holding',
      dataType: 'int16',
      unit: '',
      scale: 0.001,
      decimals: 3,
      category: 'power_factor'
    },

    // Frequency
    {
      address: 0x5B2C,
      name: 'frequency',
      description: 'System Frequency',
      type: 'holding',
      dataType: 'uint16',
      unit: 'Hz',
      scale: 0.01,
      decimals: 2,
      category: 'frequency'
    },
  ]
};

/**
 * Siemens PAC Series
 */
export const SIEMENS_PAC3200: MeterDefinition = {
  manufacturer: 'Siemens',
  model: 'PAC3200/PAC4200',
  description: 'Siemens SENTRON PAC3200/PAC4200 Power Monitoring Device',
  baudRate: [9600, 19200, 38400, 57600, 115200],
  defaultBaudRate: 19200,
  parity: ['none', 'even'],
  defaultParity: 'even',
  defaultByteOrder: 'BE',
  identificationMethod: {
    register: 0,
    type: 'holding',
    expectedValue: 0x7369, // 'si' in ASCII
  },
  registers: [
    // Power (addresses 1-12)
    {
      address: 1,
      name: 'total_active_power',
      description: 'Total Active Power',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kW',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 3,
      name: 'total_reactive_power',
      description: 'Total Reactive Power',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVAr',
      scale: 1,
      decimals: 2,
      category: 'power'
    },
    {
      address: 5,
      name: 'total_apparent_power',
      description: 'Total Apparent Power',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVA',
      scale: 1,
      decimals: 2,
      category: 'power'
    },

    // Energy (addresses 801-808)
    {
      address: 801,
      name: 'total_active_energy',
      description: 'Total Active Energy Import',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kWh',
      scale: 1,
      decimals: 2,
      category: 'energy'
    },
    {
      address: 805,
      name: 'total_reactive_energy',
      description: 'Total Reactive Energy Import',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'kVArh',
      scale: 1,
      decimals: 2,
      category: 'energy'
    },

    // Voltage (addresses 13-24)
    {
      address: 13,
      name: 'voltage_l1_n',
      description: 'Phase L1-N Voltage',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 15,
      name: 'voltage_l2_n',
      description: 'Phase L2-N Voltage',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },
    {
      address: 17,
      name: 'voltage_l3_n',
      description: 'Phase L3-N Voltage',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'V',
      scale: 1,
      decimals: 1,
      category: 'voltage'
    },

    // Current (addresses 25-32)
    {
      address: 25,
      name: 'current_l1',
      description: 'Phase L1 Current',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },
    {
      address: 27,
      name: 'current_l2',
      description: 'Phase L2 Current',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },
    {
      address: 29,
      name: 'current_l3',
      description: 'Phase L3 Current',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'A',
      scale: 1,
      decimals: 2,
      category: 'current'
    },

    // Power Factor (addresses 37-44)
    {
      address: 37,
      name: 'total_power_factor',
      description: 'Total Power Factor',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: '',
      scale: 1,
      decimals: 3,
      category: 'power_factor'
    },

    // Frequency (address 55)
    {
      address: 55,
      name: 'frequency',
      description: 'System Frequency',
      type: 'holding',
      dataType: 'float32',
      byteOrder: 'BE',
      unit: 'Hz',
      scale: 1,
      decimals: 2,
      category: 'frequency'
    },
  ]
};

/**
 * All known meter definitions
 */
export const METER_DEFINITIONS: MeterDefinition[] = [
  GENERIC_ENERGY_METER,
  SCHNEIDER_PM8000,
  ABB_M2M,
  SIEMENS_PAC3200,
];

/**
 * Get meter definition by manufacturer and model
 */
export function getMeterDefinition(manufacturer: string, model?: string): MeterDefinition | undefined {
  return METER_DEFINITIONS.find(
    def => def.manufacturer.toLowerCase() === manufacturer.toLowerCase() &&
           (!model || def.model.toLowerCase().includes(model.toLowerCase()))
  );
}

/**
 * Get generic/default meter definition
 */
export function getGenericMeterDefinition(): MeterDefinition {
  return GENERIC_ENERGY_METER;
}

/**
 * Get all supported manufacturers
 */
export function getSupportedManufacturers(): string[] {
  return Array.from(new Set(METER_DEFINITIONS.map(def => def.manufacturer)));
}

/**
 * Get models by manufacturer
 */
export function getModelsByManufacturer(manufacturer: string): string[] {
  return METER_DEFINITIONS
    .filter(def => def.manufacturer.toLowerCase() === manufacturer.toLowerCase())
    .map(def => def.model);
}
