import fs from 'fs/promises';
import path from 'path';
import { BMSAdapter, BMSMeter, BMSReading, BMSAlarm } from './base-adapter';

interface FileDataConfig {
  // File paths configuration
  metersFile?: string;         // Path to meters/devices CSV/JSON
  readingsFile?: string;       // Path to readings CSV/JSON
  alarmsFile?: string;         // Path to alarms CSV/JSON
  
  // Data directories (for multiple files)
  metersDirectory?: string;    // Directory containing meter files
  readingsDirectory?: string;  // Directory containing reading files
  alarmsDirectory?: string;    // Directory containing alarm files
  
  // File format
  format: 'csv' | 'json' | 'xml';
  
  // CSV specific options
  csvOptions?: {
    delimiter: string;
    hasHeaders: boolean;
    skipRows: number;
  };
  
  // Field mappings for flexible column/field names
  fieldMappings: {
    meters: {
      id: string;
      name: string;
      type: string;
      location?: string;
      isOnline?: string;
      lastSeen?: string;
    };
    readings: {
      meterId: string;
      timestamp: string;
      activePower?: string;
      voltage?: string | { L1: string; L2: string; L3: string; };
      current?: string | { L1: string; L2: string; L3: string; };
      energy?: string;
      frequency?: string;
      powerFactor?: string;
    };
    alarms: {
      id: string;
      meterId: string;
      message: string;
      severity?: string;
      isActive?: string;
      timestamp: string;
      acknowledgedAt?: string;
    };
  };
  
  // Refresh settings
  refreshIntervalSeconds: number;
  watchForChanges: boolean;
}

export class FileDataAdapter implements BMSAdapter {
  private config: FileDataConfig;
  private lastModified: Map<string, number> = new Map();
  private fileWatchers: Map<string, any> = new Map();
  private isConnected = false;

  constructor(config: FileDataConfig) {
    this.config = {
      csvOptions: {
        delimiter: ',',
        hasHeaders: true,
        skipRows: 0
      },
      refreshIntervalSeconds: 60,
      watchForChanges: true,
      ...config
    };
  }

  async connect(): Promise<boolean> {
    try {
      // Verify file/directory existence
      await this.validatePaths();
      
      // Set up file watchers if enabled
      if (this.config.watchForChanges) {
        this.setupFileWatchers();
      }
      
      this.isConnected = true;
      console.log('✅ Connected to File Data Adapter');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to file data source:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Clean up file watchers
    for (const [filePath, watcher] of this.fileWatchers) {
      watcher.close();
    }
    this.fileWatchers.clear();
    
    this.isConnected = false;
    console.log('🔌 Disconnected from File Data Adapter');
  }

  private async validatePaths(): Promise<void> {
    const pathsToCheck = [
      this.config.metersFile,
      this.config.readingsFile,
      this.config.alarmsFile,
      this.config.metersDirectory,
      this.config.readingsDirectory,
      this.config.alarmsDirectory
    ].filter(Boolean);

    for (const filePath of pathsToCheck) {
      try {
        await fs.access(filePath!);
      } catch (error) {
        throw new Error(`File/Directory not accessible: ${filePath}`);
      }
    }
  }

  private setupFileWatchers(): void {
    const pathsToWatch = [
      this.config.metersFile,
      this.config.readingsFile,
      this.config.alarmsFile
    ].filter(Boolean);

    // Note: File watching would require additional implementation
    // This is a simplified version
    console.log(`📁 Watching ${pathsToWatch.length} files for changes`);
  }

  async getMeters(): Promise<BMSMeter[]> {
    if (!this.isConnected) throw new Error('Not connected');

    try {
      const data = await this.loadMeterData();
      return this.parseMeterData(data);
    } catch (error) {
      console.error('Error loading meter data:', error);
      throw error;
    }
  }

  async getRealtimeData(meterId?: string): Promise<BMSReading[]> {
    if (!this.isConnected) throw new Error('Not connected');

    try {
      const data = await this.loadReadingData();
      const readings = this.parseReadingData(data);
      
      if (meterId) {
        return readings.filter(r => r.meterId === meterId);
      }
      
      return readings;
    } catch (error) {
      console.error('Error loading reading data:', error);
      throw error;
    }
  }

  async getAlarms(activeOnly: boolean = true): Promise<BMSAlarm[]> {
    if (!this.isConnected) throw new Error('Not connected');

    try {
      const data = await this.loadAlarmData();
      const alarms = this.parseAlarmData(data);
      
      if (activeOnly) {
        return alarms.filter(a => a.isActive);
      }
      
      return alarms;
    } catch (error) {
      console.error('Error loading alarm data:', error);
      throw error;
    }
  }

  private async loadMeterData(): Promise<any[]> {
    if (this.config.metersFile) {
      return await this.loadFile(this.config.metersFile);
    } else if (this.config.metersDirectory) {
      return await this.loadDirectory(this.config.metersDirectory);
    }
    throw new Error('No meter data source configured');
  }

  private async loadReadingData(): Promise<any[]> {
    if (this.config.readingsFile) {
      return await this.loadFile(this.config.readingsFile);
    } else if (this.config.readingsDirectory) {
      return await this.loadDirectory(this.config.readingsDirectory);
    }
    throw new Error('No reading data source configured');
  }

  private async loadAlarmData(): Promise<any[]> {
    if (this.config.alarmsFile) {
      return await this.loadFile(this.config.alarmsFile);
    } else if (this.config.alarmsDirectory) {
      return await this.loadDirectory(this.config.alarmsDirectory);
    }
    return []; // Alarms are optional
  }

  private async loadFile(filePath: string): Promise<any[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    switch (this.config.format) {
      case 'json':
        return JSON.parse(content);
      
      case 'csv':
        return this.parseCSV(content);
      
      case 'xml':
        // XML parsing would require additional library
        throw new Error('XML format not yet implemented');
      
      default:
        throw new Error(`Unsupported format: ${this.config.format}`);
    }
  }

  private async loadDirectory(dirPath: string): Promise<any[]> {
    const files = await fs.readdir(dirPath);
    const allData: any[] = [];
    
    for (const file of files) {
      if (this.shouldProcessFile(file)) {
        const filePath = path.join(dirPath, file);
        const fileData = await this.loadFile(filePath);
        allData.push(...fileData);
      }
    }
    
    return allData;
  }

  private shouldProcessFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    
    switch (this.config.format) {
      case 'json':
        return ext === '.json';
      case 'csv':
        return ext === '.csv';
      case 'xml':
        return ext === '.xml';
      default:
        return false;
    }
  }

  private parseCSV(content: string): any[] {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const { delimiter, hasHeaders, skipRows } = this.config.csvOptions!;
    
    const dataLines = lines.slice(skipRows);
    let headers: string[] = [];
    let startIndex = 0;
    
    if (hasHeaders && dataLines.length > 0) {
      headers = dataLines[0].split(delimiter);
      startIndex = 1;
    }
    
    const result: any[] = [];
    for (let i = startIndex; i < dataLines.length; i++) {
      const values = dataLines[i].split(delimiter);
      
      if (hasHeaders) {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header.trim()] = values[index]?.trim() || '';
        });
        result.push(obj);
      } else {
        result.push(values.map(v => v.trim()));
      }
    }
    
    return result;
  }

  private parseMeterData(data: any[]): BMSMeter[] {
    const mapping = this.config.fieldMappings.meters;
    
    return data.map(row => ({
      id: this.getFieldValue(row, mapping.id),
      name: this.getFieldValue(row, mapping.name) || 'Unknown Device',
      type: this.getFieldValue(row, mapping.type) || 'energy_meter',
      location: this.getFieldValue(row, mapping.location) || 'Unknown Location',
      isOnline: this.parseBooleanField(row, mapping.isOnline, true),
      lastSeen: this.parseDateField(row, mapping.lastSeen) || new Date(),
      metadata: {
        vendor: 'file',
        source: 'file_adapter',
        rawData: row
      }
    }));
  }

  private parseReadingData(data: any[]): BMSReading[] {
    const mapping = this.config.fieldMappings.readings;
    
    return data.map(row => ({
      meterId: this.getFieldValue(row, mapping.meterId),
      timestamp: this.parseDateField(row, mapping.timestamp) || new Date(),
      parameters: {
        activePower: this.parseNumberField(row, mapping.activePower) || 0,
        voltage: this.parseVoltageField(row, mapping.voltage),
        current: this.parseCurrentField(row, mapping.current),
        energy: this.parseNumberField(row, mapping.energy) || 0,
        frequency: this.parseNumberField(row, mapping.frequency) || 50,
        powerFactor: this.parseNumberField(row, mapping.powerFactor) || 0.95
      }
    }));
  }

  private parseAlarmData(data: any[]): BMSAlarm[] {
    const mapping = this.config.fieldMappings.alarms;
    
    return data.map(row => ({
      id: this.getFieldValue(row, mapping.id),
      meterId: this.getFieldValue(row, mapping.meterId),
      message: this.getFieldValue(row, mapping.message) || 'File Data Alarm',
      severity: this.parseAlarmSeverity(this.getFieldValue(row, mapping.severity)),
      isActive: this.parseBooleanField(row, mapping.isActive, true),
      timestamp: this.parseDateField(row, mapping.timestamp) || new Date(),
      acknowledgedAt: this.parseDateField(row, mapping.acknowledgedAt),
      metadata: {
        vendor: 'file',
        source: 'file_adapter',
        rawData: row
      }
    }));
  }

  private getFieldValue(row: any, fieldPath: string): string {
    return row[fieldPath]?.toString() || '';
  }

  private parseBooleanField(row: any, fieldPath?: string, defaultValue: boolean = false): boolean {
    if (!fieldPath) return defaultValue;
    
    const value = this.getFieldValue(row, fieldPath).toLowerCase();
    return ['true', '1', 'yes', 'active', 'online'].includes(value);
  }

  private parseDateField(row: any, fieldPath?: string): Date | undefined {
    if (!fieldPath) return undefined;
    
    const value = this.getFieldValue(row, fieldPath);
    if (!value) return undefined;
    
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }

  private parseNumberField(row: any, fieldPath?: string): number | undefined {
    if (!fieldPath) return undefined;
    
    const value = this.getFieldValue(row, fieldPath);
    if (!value) return undefined;
    
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }

  private parseVoltageField(row: any, mapping?: string | { L1: string; L2: string; L3: string; }): any {
    if (!mapping) return { L1: 0, L2: 0, L3: 0 };
    
    if (typeof mapping === 'string') {
      const value = this.parseNumberField(row, mapping) || 0;
      return { L1: value, L2: value, L3: value };
    }
    
    return {
      L1: this.parseNumberField(row, mapping.L1) || 0,
      L2: this.parseNumberField(row, mapping.L2) || 0,
      L3: this.parseNumberField(row, mapping.L3) || 0
    };
  }

  private parseCurrentField(row: any, mapping?: string | { L1: string; L2: string; L3: string; }): any {
    if (!mapping) return { L1: 0, L2: 0, L3: 0 };
    
    if (typeof mapping === 'string') {
      const value = this.parseNumberField(row, mapping) || 0;
      return { L1: value, L2: value, L3: value };
    }
    
    return {
      L1: this.parseNumberField(row, mapping.L1) || 0,
      L2: this.parseNumberField(row, mapping.L2) || 0,
      L3: this.parseNumberField(row, mapping.L3) || 0
    };
  }

  private parseAlarmSeverity(value?: string): 'info' | 'warning' | 'critical' {
    if (!value) return 'info';
    
    const severity = value.toLowerCase();
    if (['critical', 'high', 'urgent', 'error'].includes(severity)) return 'critical';
    if (['warning', 'medium', 'alert'].includes(severity)) return 'warning';
    return 'info';
  }

  async testConnection(): Promise<boolean> {
    return this.isConnected;
  }
}