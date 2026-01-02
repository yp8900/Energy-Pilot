import sql, { ConnectionPool } from 'mssql';
import { BMSAdapter, BMSMeter, BMSReading, BMSAlarm, VendorMapping } from './base-adapter';

interface SiemensDatabaseConfig {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  options?: {
    trustServerCertificate?: boolean;
    encrypt?: boolean;
    enableArithAbort?: boolean;
  };
}

export class SiemensAdapter implements BMSAdapter {
  private config: SiemensDatabaseConfig;
  private connectionPool: ConnectionPool | null = null;
  
  // Siemens Navigator typically uses different table structures
  private readonly vendorMapping: VendorMapping = {
    meterTable: 'Navigator_Devices',
    meterFields: {
      id: 'DeviceID',
      name: 'DeviceName',
      type: 'DeviceType',
      location: 'Location',
      isOnline: 'IsOnline',
      lastSeen: 'LastCommunication'
    },
    readingTable: 'Navigator_DataPoints',
    readingFields: {
      meterId: 'DeviceID',
      timestamp: 'Timestamp',
      activePower: 'ActivePowerTotal_kW',
      voltage: {
        L1: 'VoltageL1_V',
        L2: 'VoltageL2_V',
        L3: 'VoltageL3_V'
      },
      current: {
        L1: 'CurrentL1_A',
        L2: 'CurrentL2_A',
        L3: 'CurrentL3_A'
      },
      energy: 'TotalActiveEnergy_kWh',
      frequency: 'Frequency_Hz',
      powerFactor: 'PowerFactor'
    },
    alarmTable: 'Navigator_Alarms',
    alarmFields: {
      id: 'AlarmID',
      meterId: 'DeviceID',
      message: 'AlarmDescription',
      severity: 'Priority',
      isActive: 'IsActive',
      timestamp: 'AlarmDateTime',
      acknowledgedAt: 'AcknowledgedAt'
    }
  };

  constructor(config: SiemensDatabaseConfig) {
    this.config = {
      ...config,
      options: {
        trustServerCertificate: true,
        encrypt: true,
        enableArithAbort: true,
        ...config.options
      }
    };
  }

  async connect(): Promise<boolean> {
    try {
      this.connectionPool = new ConnectionPool({
        server: this.config.server,
        port: this.config.port || 1433,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        options: this.config.options,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        },
        requestTimeout: 15000
      });

      await this.connectionPool.connect();
      console.log('✅ Connected to Siemens Navigator BMS database');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Siemens Navigator:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectionPool) {
      await this.connectionPool.close();
      this.connectionPool = null;
      console.log('🔌 Disconnected from Siemens Navigator BMS');
    }
  }

  async getMeters(): Promise<BMSMeter[]> {
    if (!this.connectionPool) throw new Error('Not connected to database');

    try {
      const query = `
        SELECT 
          ${this.vendorMapping.meterFields.id} as id,
          ${this.vendorMapping.meterFields.name} as name,
          ${this.vendorMapping.meterFields.type} as type,
          ${this.vendorMapping.meterFields.location} as location,
          ${this.vendorMapping.meterFields.isOnline} as isOnline,
          ${this.vendorMapping.meterFields.lastSeen} as lastSeen
        FROM ${this.vendorMapping.meterTable}
        WHERE ${this.vendorMapping.meterFields.type} LIKE '%meter%'
           OR ${this.vendorMapping.meterFields.type} LIKE '%energy%'
        ORDER BY ${this.vendorMapping.meterFields.name}
      `;

      const result = await this.connectionPool.request().query(query);
      
      return result.recordset.map(row => ({
        id: row.id.toString(),
        name: row.name || 'Unknown Device',
        type: row.type || 'energy_meter',
        location: row.location || 'Unknown Location',
        isOnline: !!row.isOnline,
        lastSeen: row.lastSeen || new Date(),
        metadata: {
          vendor: 'siemens',
          system: 'navigator',
          originalType: row.type
        }
      }));
    } catch (error) {
      console.error('Error fetching Siemens meters:', error);
      throw error;
    }
  }

  async getRealtimeData(meterId?: string): Promise<BMSReading[]> {
    if (!this.connectionPool) throw new Error('Not connected to database');

    try {
      let whereClause = '';
      if (meterId) {
        whereClause = `WHERE ${this.vendorMapping.readingFields.meterId} = @meterId`;
      } else {
        // Get latest reading for each meter (last 5 minutes)
        whereClause = `WHERE ${this.vendorMapping.readingFields.timestamp} >= DATEADD(MINUTE, -5, GETDATE())`;
      }

      const query = `
        SELECT 
          ${this.vendorMapping.readingFields.meterId} as meterId,
          ${this.vendorMapping.readingFields.timestamp} as timestamp,
          ${this.vendorMapping.readingFields.activePower} as activePower,
          ${this.vendorMapping.readingFields.voltage.L1} as voltageL1,
          ${this.vendorMapping.readingFields.voltage.L2} as voltageL2,
          ${this.vendorMapping.readingFields.voltage.L3} as voltageL3,
          ${this.vendorMapping.readingFields.current.L1} as currentL1,
          ${this.vendorMapping.readingFields.current.L2} as currentL2,
          ${this.vendorMapping.readingFields.current.L3} as currentL3,
          ${this.vendorMapping.readingFields.energy} as energy,
          ${this.vendorMapping.readingFields.frequency} as frequency,
          ${this.vendorMapping.readingFields.powerFactor} as powerFactor
        FROM ${this.vendorMapping.readingTable}
        ${whereClause}
        ORDER BY ${this.vendorMapping.readingFields.timestamp} DESC
      `;

      const request = this.connectionPool.request();
      if (meterId) {
        request.input('meterId', sql.VarChar, meterId);
      }

      const result = await request.query(query);
      
      return result.recordset.map(row => ({
        meterId: row.meterId.toString(),
        timestamp: row.timestamp || new Date(),
        parameters: {
          activePower: row.activePower || 0,
          voltage: {
            L1: row.voltageL1 || 0,
            L2: row.voltageL2 || 0,
            L3: row.voltageL3 || 0
          },
          current: {
            L1: row.currentL1 || 0,
            L2: row.currentL2 || 0,
            L3: row.currentL3 || 0
          },
          energy: row.energy || 0,
          frequency: row.frequency || 50,
          powerFactor: row.powerFactor || 0.95
        }
      }));
    } catch (error) {
      console.error('Error fetching Siemens realtime data:', error);
      throw error;
    }
  }

  async getAlarms(activeOnly: boolean = true): Promise<BMSAlarm[]> {
    if (!this.connectionPool) throw new Error('Not connected to database');

    try {
      let whereClause = '';
      if (activeOnly) {
        whereClause = `WHERE ${this.vendorMapping.alarmFields.isActive} = 1 
                      AND ${this.vendorMapping.alarmFields.acknowledgedAt} IS NULL`;
      }

      const query = `
        SELECT 
          ${this.vendorMapping.alarmFields.id} as id,
          ${this.vendorMapping.alarmFields.meterId} as meterId,
          ${this.vendorMapping.alarmFields.message} as message,
          ${this.vendorMapping.alarmFields.severity} as severity,
          ${this.vendorMapping.alarmFields.isActive} as isActive,
          ${this.vendorMapping.alarmFields.timestamp} as timestamp,
          ${this.vendorMapping.alarmFields.acknowledgedAt} as acknowledgedAt
        FROM ${this.vendorMapping.alarmTable}
        ${whereClause}
        ORDER BY ${this.vendorMapping.alarmFields.timestamp} DESC
      `;

      const result = await this.connectionPool.request().query(query);
      
      return result.recordset.map(row => ({
        id: row.id.toString(),
        meterId: row.meterId.toString(),
        message: row.message || 'Siemens Navigator Alarm',
        severity: this.mapSiemensSeverity(row.severity),
        isActive: !!row.isActive,
        timestamp: row.timestamp || new Date(),
        acknowledgedAt: row.acknowledgedAt,
        metadata: {
          vendor: 'siemens',
          system: 'navigator',
          originalSeverity: row.severity
        }
      }));
    } catch (error) {
      console.error('Error fetching Siemens alarms:', error);
      throw error;
    }
  }

  private mapSiemensSeverity(siemensPriority: any): 'info' | 'warning' | 'critical' {
    if (typeof siemensPriority === 'string') {
      const priority = siemensPriority.toLowerCase();
      if (priority.includes('high') || priority.includes('urgent')) return 'critical';
      if (priority.includes('medium') || priority.includes('warning')) return 'warning';
      return 'info';
    }
    
    if (typeof siemensPriority === 'number') {
      if (siemensPriority >= 3) return 'critical';
      if (siemensPriority >= 2) return 'warning';
      return 'info';
    }
    
    return 'info';
  }

  async testConnection(): Promise<boolean> {
    if (!this.connectionPool) return false;

    try {
      await this.connectionPool.request().query('SELECT 1 as test');
      return true;
    } catch (error) {
      return false;
    }
  }
}