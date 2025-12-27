import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  // Replit Auth doesn't use passwords, but we keep the structure compatible if needed or for profile info
  email: text("email"),
  role: text("role").default("operator"), // admin, operator, viewer
  createdAt: timestamp("created_at").defaultNow(),
});

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'PLC', 'Smart Meter', 'Sensor'
  location: text("location"),
  ipAddress: text("ip_address"),
  status: text("status").default("offline"), // 'online', 'offline', 'maintenance'
  lastSeen: timestamp("last_seen"),
  config: jsonb("config"), // Store arbitrary config like thresholds
  createdAt: timestamp("created_at").defaultNow(),
});

export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  power: doublePrecision("power"), // kW
  voltage: doublePrecision("voltage"), // V
  current: doublePrecision("current"), // A
  energy: doublePrecision("energy"), // kWh total
  frequency: doublePrecision("frequency"), // Hz
  powerFactor: doublePrecision("power_factor"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  severity: text("severity").notNull(), // 'critical', 'warning', 'info'
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedBy: integer("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
});

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true, lastSeen: true, createdAt: true });
export const insertReadingSchema = createInsertSchema(readings).omit({ id: true, timestamp: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, timestamp: true, acknowledged: true, acknowledgedBy: true, acknowledgedAt: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export type Reading = typeof readings.$inferSelect;
export type InsertReading = z.infer<typeof insertReadingSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

// Request Types
export type CreateDeviceRequest = InsertDevice;
export type UpdateDeviceRequest = Partial<InsertDevice>;

export type CreateAlertRequest = InsertAlert;
export type AcknowledgeAlertRequest = { userId?: number };

// Response Types
export type DeviceResponse = Device;
export type ReadingResponse = Reading;
export type AlertResponse = Alert & { deviceName?: string }; // Joined with device name
