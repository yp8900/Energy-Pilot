import { db } from "./db";
import {
  devices, readings, alerts,
  type Device, type InsertDevice,
  type Reading, type InsertReading,
  type Alert, type InsertAlert
} from "@shared/schema";
import { eq, desc, and, gte, lt } from "drizzle-orm";

export interface IStorage {
  // Devices
  getDevices(): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: number, updates: Partial<InsertDevice>): Promise<Device>;
  deleteDevice(id: number): Promise<void>;

  // Readings
  getLatestReading(deviceId: number): Promise<Reading | undefined>;
  getReadings(deviceId: number, limit: number): Promise<Reading[]>;
  createReading(reading: InsertReading): Promise<Reading>;

  // Alerts
  getAlerts(status?: 'active' | 'acknowledged' | 'all'): Promise<(Alert & { deviceName: string })[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  acknowledgeAlert(id: number, userId: number): Promise<Alert>;

  // Analytics
  getAnalyticsOverview(): Promise<{
    totalConsumption: number;
    activeAlarms: number;
    onlineDevices: number;
    totalDevices: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getDevices(): Promise<Device[]> {
    return await db.select().from(devices).orderBy(devices.id);
  }

  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const [newDevice] = await db.insert(devices).values(device).returning();
    return newDevice;
  }

  async updateDevice(id: number, updates: Partial<InsertDevice>): Promise<Device> {
    const [updated] = await db.update(devices).set(updates).where(eq(devices.id, id)).returning();
    return updated;
  }

  async deleteDevice(id: number): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async getLatestReading(deviceId: number): Promise<Reading | undefined> {
    const [reading] = await db.select()
      .from(readings)
      .where(eq(readings.deviceId, deviceId))
      .orderBy(desc(readings.timestamp))
      .limit(1);
    return reading;
  }

  async getReadings(deviceId: number, limit: number): Promise<Reading[]> {
    return await db.select()
      .from(readings)
      .where(eq(readings.deviceId, deviceId))
      .orderBy(desc(readings.timestamp))
      .limit(limit);
  }

  async createReading(reading: InsertReading): Promise<Reading> {
    const [newReading] = await db.insert(readings).values(reading).returning();
    return newReading;
  }

  async getAlerts(status?: 'active' | 'acknowledged' | 'all'): Promise<(Alert & { deviceName: string })[]> {
    const query = db.select({
      id: alerts.id,
      deviceId: alerts.deviceId,
      severity: alerts.severity,
      message: alerts.message,
      timestamp: alerts.timestamp,
      acknowledged: alerts.acknowledged,
      acknowledgedBy: alerts.acknowledgedBy,
      acknowledgedAt: alerts.acknowledgedAt,
      deviceName: devices.name,
    })
      .from(alerts)
      .innerJoin(devices, eq(alerts.deviceId, devices.id));

    if (status === 'active') {
      query.where(eq(alerts.acknowledged, false));
    } else if (status === 'acknowledged') {
      query.where(eq(alerts.acknowledged, true));
    }

    return await query.orderBy(desc(alerts.timestamp));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [newAlert] = await db.insert(alerts).values(alert).returning();
    return newAlert;
  }

  async acknowledgeAlert(id: number, userId?: number): Promise<Alert> {
    // Note: userId is optional in the interface but recommended for audit
    const [updated] = await db.update(alerts)
      .set({
        acknowledged: true,
        acknowledgedBy: userId ?? null, // Handle null case if user system not fully linked
        acknowledgedAt: new Date(),
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated;
  }

  async getAnalyticsOverview(): Promise<{
    totalConsumption: number;
    activeAlarms: number;
    onlineDevices: number;
    totalDevices: number;
  }> {
    // This is a simplified implementation. Real-world would use aggregation queries.
    // For MVP, we can sum latest readings or use a stored 'energy' field.
    const allDevices = await this.getDevices();
    const onlineDevices = allDevices.filter(d => d.status === 'online').length;

    const activeAlarms = (await this.getAlerts('active')).length;

    // Get latest power from all devices
    let totalConsumption = 0;
    for (const d of allDevices) {
      const latest = await this.getLatestReading(d.id);
      if (latest?.power) {
        totalConsumption += latest.power;
      }
    }

    return {
      totalConsumption,
      activeAlarms,
      onlineDevices,
      totalDevices: allDevices.length,
    };
  }
}

export const storage = new DatabaseStorage();
