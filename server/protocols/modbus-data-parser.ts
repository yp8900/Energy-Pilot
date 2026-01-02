/**
 * Modbus Data Parser
 * Handles parsing of different data types and byte orders from Modbus registers
 */

import { ByteOrder, ModbusDataType } from './meter-definitions';

/**
 * Parse Modbus register data based on data type and byte order
 */
export function parseModbusValue(
  registers: number[],
  dataType: ModbusDataType,
  byteOrder: ByteOrder = 'BE'
): number | string | null {
  try {
    switch (dataType) {
      case 'uint16':
        return parseUInt16(registers[0]);
      
      case 'int16':
        return parseInt16(registers[0]);
      
      case 'uint32':
        return parseUInt32(registers.slice(0, 2), byteOrder);
      
      case 'int32':
        return parseInt32(registers.slice(0, 2), byteOrder);
      
      case 'float32':
        return parseFloat32(registers.slice(0, 2), byteOrder);
      
      case 'float64':
        return parseFloat64(registers.slice(0, 4), byteOrder);
      
      case 'string':
        return parseString(registers);
      
      default:
        console.warn(`Unknown data type: ${dataType}`);
        return null;
    }
  } catch (error: any) {
    console.error(`Failed to parse value: ${error.message}`);
    return null;
  }
}

/**
 * Parse unsigned 16-bit integer (single register)
 */
function parseUInt16(register: number): number {
  return register & 0xFFFF;
}

/**
 * Parse signed 16-bit integer (single register)
 */
function parseInt16(register: number): number {
  const value = register & 0xFFFF;
  // Convert to signed
  return value > 0x7FFF ? value - 0x10000 : value;
}

/**
 * Parse unsigned 32-bit integer (two registers)
 */
function parseUInt32(registers: number[], byteOrder: ByteOrder): number {
  const buffer = createBuffer(registers, byteOrder);
  return buffer.readUInt32BE(0);
}

/**
 * Parse signed 32-bit integer (two registers)
 */
function parseInt32(registers: number[], byteOrder: ByteOrder): number {
  const buffer = createBuffer(registers, byteOrder);
  return buffer.readInt32BE(0);
}

/**
 * Parse 32-bit IEEE 754 float (two registers)
 */
function parseFloat32(registers: number[], byteOrder: ByteOrder): number {
  const buffer = createBuffer(registers, byteOrder);
  const value = buffer.readFloatBE(0);
  
  // Check for valid float
  if (isNaN(value) || !isFinite(value)) {
    return 0;
  }
  
  return value;
}

/**
 * Parse 64-bit IEEE 754 double (four registers)
 */
function parseFloat64(registers: number[], byteOrder: ByteOrder): number {
  if (registers.length < 4) {
    throw new Error('Need 4 registers for float64');
  }
  
  const buffer = createBuffer(registers, byteOrder);
  const value = buffer.readDoubleBE(0);
  
  // Check for valid double
  if (isNaN(value) || !isFinite(value)) {
    return 0;
  }
  
  return value;
}

/**
 * Parse ASCII string from registers
 */
function parseString(registers: number[]): string {
  const buffer = Buffer.allocUnsafe(registers.length * 2);
  
  for (let i = 0; i < registers.length; i++) {
    buffer.writeUInt16BE(registers[i], i * 2);
  }
  
  // Convert to string and remove null terminators
  return buffer.toString('ascii').replace(/\0/g, '').trim();
}

/**
 * Create a buffer from registers with specified byte order
 */
function createBuffer(registers: number[], byteOrder: ByteOrder): Buffer {
  const buffer = Buffer.allocUnsafe(registers.length * 2);
  
  switch (byteOrder) {
    case 'BE': // Big Endian (ABCD) - Standard Modbus
      for (let i = 0; i < registers.length; i++) {
        buffer.writeUInt16BE(registers[i], i * 2);
      }
      break;
    
    case 'LE': // Little Endian (DCBA)
      for (let i = 0; i < registers.length; i++) {
        buffer.writeUInt16LE(registers[i], i * 2);
      }
      break;
    
    case 'BE_SWAP': // Big Endian Byte Swap (BADC)
      for (let i = 0; i < registers.length; i++) {
        const value = registers[i];
        const swapped = ((value & 0xFF) << 8) | ((value >> 8) & 0xFF);
        buffer.writeUInt16BE(swapped, i * 2);
      }
      break;
    
    case 'LE_SWAP': // Little Endian Byte Swap (CDAB)
      for (let i = 0; i < registers.length; i++) {
        const value = registers[i];
        const swapped = ((value & 0xFF) << 8) | ((value >> 8) & 0xFF);
        buffer.writeUInt16LE(swapped, i * 2);
      }
      break;
    
    default:
      throw new Error(`Unknown byte order: ${byteOrder}`);
  }
  
  return buffer;
}

/**
 * Format value for display
 */
export function formatValue(
  value: number | string | null,
  unit: string,
  decimals: number = 2
): string {
  if (value === null) {
    return 'N/A';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  const formatted = value.toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Apply scale and offset to value
 */
export function applyScaling(
  value: number,
  scale: number = 1,
  offset: number = 0
): number {
  return (value * scale) + offset;
}

/**
 * Calculate word count needed for data type
 */
export function getWordCount(dataType: ModbusDataType): number {
  switch (dataType) {
    case 'uint16':
    case 'int16':
      return 1;
    
    case 'uint32':
    case 'int32':
    case 'float32':
      return 2;
    
    case 'float64':
      return 4;
    
    case 'string':
      return 10; // Default string length (20 chars)
    
    default:
      return 1;
  }
}

/**
 * Validate register value is reasonable
 */
export function isValidValue(
  value: number | string | null,
  dataType: ModbusDataType
): boolean {
  if (value === null) {
    return false;
  }
  
  if (typeof value === 'string') {
    return value.length > 0;
  }
  
  // Check for NaN or Infinity
  if (!isFinite(value)) {
    return false;
  }
  
  // Check for reasonable ranges based on data type
  switch (dataType) {
    case 'uint16':
      return value >= 0 && value <= 0xFFFF;
    
    case 'int16':
      return value >= -32768 && value <= 32767;
    
    case 'uint32':
      return value >= 0 && value <= 0xFFFFFFFF;
    
    case 'int32':
      return value >= -2147483648 && value <= 2147483647;
    
    case 'float32':
    case 'float64':
      // Allow wide range for floats, but reject extreme values
      return Math.abs(value) < 1e10;
    
    default:
      return true;
  }
}

/**
 * Auto-detect byte order by comparing parsed values
 */
export async function detectByteOrder(
  readFn: (address: number, count: number) => Promise<number[]>,
  testAddress: number
): Promise<ByteOrder> {
  const byteOrders: ByteOrder[] = ['BE', 'LE', 'BE_SWAP', 'LE_SWAP'];
  const results: Array<{ order: ByteOrder; value: number; score: number }> = [];
  
  try {
    const registers = await readFn(testAddress, 2);
    
    for (const order of byteOrders) {
      const value = parseFloat32(registers, order);
      
      // Score based on reasonableness (voltage should be 100-500V, current 0-1000A, etc.)
      let score = 0;
      
      if (isFinite(value) && !isNaN(value)) {
        // Prefer values in typical power system ranges
        if (value > 0 && value < 10000) {
          score += 10;
        }
        
        // Prefer values that aren't too precise (energy meters usually have 1-3 decimals)
        const decimals = (value.toString().split('.')[1] || '').length;
        if (decimals <= 3) {
          score += 5;
        }
        
        results.push({ order, value, score });
      }
    }
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    if (results.length > 0) {
      console.log(`🔍 Detected byte order: ${results[0].order} (value: ${results[0].value}, score: ${results[0].score})`);
      return results[0].order;
    }
  } catch (error: any) {
    console.warn(`⚠️  Byte order detection failed: ${error.message}`);
  }
  
  // Default to Big Endian (standard Modbus)
  return 'BE';
}

/**
 * Test read register to verify it's accessible
 */
export async function testRegister(
  readFn: (address: number, count: number, type: 'holding' | 'input') => Promise<number[]>,
  address: number,
  wordCount: number,
  type: 'holding' | 'input'
): Promise<boolean> {
  try {
    const result = await readFn(address, wordCount, type);
    return result && result.length === wordCount;
  } catch (error) {
    return false;
  }
}
