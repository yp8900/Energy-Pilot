import sql from 'mssql';
import { BMSAdapter, BMSMeter, BMSReading, BMSAlarm, VendorMapping } from './base-adapter';
import { log } from '../index';

// Schneider Electric EcoStruxure adapter
export class SchneiderAdapter implements BMSAdapter {
  private pool?: sql.ConnectionPool;
  private config: any;
  private mapping: VendorMapping = {
    vendor: 'Schneider Electric',
    tables: {
      meters: 'ION_Data.dbo.Device',
      readings: 'ION_Data.dbo.Data', 
      alarms: 'ION_Data.dbo.EventLog',
      historical: 'ION_Data.dbo.HistorianData'
    },
    fields: {
      meterId: 'DeviceID',
      meterName: 'Name',
      timestamp: 'TimeStamp',
      activePower: 'Pwr_Total',
      voltage: { L1: 'Va', L2: 'Vb', L3: 'Vc' },
      current: { L1: 'Ia', L2: 'Ib', L3: 'Ic' }
    },
    transformations: {
      powerUnit: 'kW',
      voltageUnit: 'V',
      currentUnit: 'A'
    }
  };

  constructor(config: any) {
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      this.pool = new sql.ConnectionPool(this.config);
      await this.pool.connect();
      log('Connected to Schneider EcoStruxure BMS', 'BMS-Schneider');
      return true;
    } catch (error) {
      log(`Schneider connection failed: ${error}`, 'BMS-Schneider');
      return false;
    }
  }

  async validateSchema(): Promise<boolean> {
    if (!this.pool) return false;
    
    try {
      // Check if Schneider-specific tables exist
      const tables = await this.pool.request().query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME IN ('Device', 'Data', 'EventLog')
      `);
      
      return tables.recordset.length >= 2; // At least Device and Data tables
    } catch (error) {
      return false;
    }
  }

  async getMeters(): Promise<BMSMeter[]> {
    if (!this.pool) throw new Error('Not connected to Schneider BMS');
    
    const result = await this.pool.request().query(`
      SELECT 
        ${this.mapping.fields.meterId} as MeterId,
        ${this.mapping.fields.meterName} as MeterName,
        Type,
        Location,
        LastCommunication,
        Status
      FROM ${this.mapping.tables.meters}
      WHERE Type LIKE '%Meter%' OR Type LIKE '%PM%'
    `);
    
    return result.recordset.map(row => ({
      id: row.MeterId.toString(),
      name: row.MeterName,
      type: row.Type,
      location: row.Location || 'Unknown',
      isOnline: row.Status === 'Online',
      lastSeen: new Date(row.LastCommunication),
      metadata: { vendor: 'Schneider', type: row.Type }
    }));
  }

  async getRealtimeData(meterId?: string): Promise<BMSReading[]> {
    if (!this.pool) throw new Error('Not connected to Schneider BMS');
    
    const whereClause = meterId ? `AND d.${this.mapping.fields.meterId} = '${meterId}'` : '';
    
    const result = await this.pool.request().query(`
      SELECT TOP 100
        d.${this.mapping.fields.meterId} as MeterId,
        d.${this.mapping.fields.timestamp} as Timestamp,
        d.${this.mapping.fields.activePower} as ActivePower,
        d.${this.mapping.fields.voltage.L1} as VoltageL1,
        d.${this.mapping.fields.voltage.L2} as VoltageL2,
        d.${this.mapping.fields.voltage.L3} as VoltageL3,
        d.${this.mapping.fields.current.L1} as CurrentL1,
        d.${this.mapping.fields.current.L2} as CurrentL2,
        d.${this.mapping.fields.current.L3} as CurrentL3,
        d.PF_Total as PowerFactor,
        d.Freq as Frequency
      FROM ${this.mapping.tables.readings} d
      WHERE d.${this.mapping.fields.timestamp} >= DATEADD(minute, -15, GETDATE())
      ${whereClause}
      ORDER BY d.${this.mapping.fields.timestamp} DESC
    `);
    
    return result.recordset.map(row => ({
      meterId: row.MeterId.toString(),
      timestamp: new Date(row.Timestamp),
      parameters: {
        activePower: row.ActivePower,
        voltage: {
          L1: row.VoltageL1,
          L2: row.VoltageL2,
          L3: row.VoltageL3
        },
        current: {
          L1: row.CurrentL1,
          L2: row.CurrentL2,
          L3: row.CurrentL3
        },
        powerFactor: row.PowerFactor,
        frequency: row.Frequency
      },
      quality: 'good'
    }));
  }

  async getAlarms(activeOnly: boolean = true): Promise<BMSAlarm[]> {
    if (!this.pool) throw new Error('Not connected to Schneider BMS');
    
    const whereClause = activeOnly ? "AND Status = 'Active'" : '';
    
    const result = await this.pool.request().query(`
      SELECT 
        EventID as AlarmId,
        DeviceID as MeterId,
        EventType as Type,
        Priority as Severity,
        Message,
        TimeStamp as Timestamp,
        Status,
        AcknowledgedBy
      FROM ${this.mapping.tables.alarms}
      WHERE EventType IN ('Alarm', 'Warning', 'Critical')
      ${whereClause}
      ORDER BY TimeStamp DESC
    `);
    
    return result.recordset.map(row => ({
      id: row.AlarmId.toString(),
      meterId: row.MeterId.toString(),
      type: row.Type,
      severity: this.mapSeverity(row.Severity),
      message: row.Message,
      timestamp: new Date(row.Timestamp),
      isActive: row.Status === 'Active',
      acknowledgedBy: row.AcknowledgedBy
    }));
  }

  async getHistoricalData(meterId: string, startTime: Date, endTime: Date): Promise<BMSReading[]> {
    // Implementation for historical data retrieval
    throw new Error('Historical data not yet implemented for Schneider adapter');
  }

  private mapSeverity(priority: string | number): 'low' | 'medium' | 'high' | 'critical' {
    if (typeof priority === 'number') {
      if (priority >= 8) return 'critical';
      if (priority >= 6) return 'high';
      if (priority >= 4) return 'medium';
      return 'low';
    }
    
    const p = priority.toLowerCase();
    if (p.includes('critical') || p.includes('emergency')) return 'critical';
    if (p.includes('high') || p.includes('major')) return 'high';
    if (p.includes('medium') || p.includes('minor')) return 'medium';
    return 'low';
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      log('Disconnected from Schneider BMS', 'BMS-Schneider');
    }
  }

  startSync(intervalMinutes: number): void {
    // Implementation for sync
  }

  stopSync(): void {
    // Implementation for stopping sync
  }
}