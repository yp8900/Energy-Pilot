import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export * from "./models/auth";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email"),
  role: text("role").default("operator"), // admin, operator, viewer
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  voltage: doublePrecision("voltage"), // V (average)
  voltageL1L2: doublePrecision("voltage_l1_l2"), // V L1-L2 phase
  voltageL2L3: doublePrecision("voltage_l2_l3"), // V L2-L3 phase
  voltageL3L1: doublePrecision("voltage_l3_l1"), // V L3-L1 phase
  current: doublePrecision("current"), // A (average)
  currentL1: doublePrecision("current_l1"), // A L1 phase
  currentL2: doublePrecision("current_l2"), // A L2 phase
  currentL3: doublePrecision("current_l3"), // A L3 phase
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
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
});

export const thresholds = pgTable("thresholds", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devices.id), // null for global thresholds
  deviceType: text("device_type"), // 'smart_meter', 'plc', 'sensor', or null for all
  parameter: text("parameter").notNull(), // 'power', 'voltage', 'current', etc.
  operator: text("operator").notNull(), // 'greater_than', 'less_than', 'equals'
  value: doublePrecision("value").notNull(),
  unit: text("unit").notNull(),
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  enabled: boolean("enabled").default(true),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === BACnet Integration Tables ===

export const bacnetControllers = pgTable("bacnet_controllers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull().unique(),
  deviceId: integer("device_id").notNull(), // BACnet Device ID
  port: integer("port").default(47808),
  status: text("status").default("offline"), // 'online', 'offline', 'error'
  lastSeen: timestamp("last_seen"),
  
  // Auto-detected vendor information
  vendorId: integer("vendor_id"),
  vendorName: text("vendor_name"), // 'Loytec', 'Honeywell', 'Johnson Controls'
  modelNumber: text("model_number"),
  firmwareVersion: text("firmware_version"),
  maxApdu: integer("max_apdu").default(1476),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const modbusDevices = pgTable("modbus_devices", {
  id: serial("id").primaryKey(),
  bacnetControllerId: integer("bacnet_controller_id").notNull().references(() => bacnetControllers.id),
  modbusAddress: integer("modbus_address").notNull(), // 1-247
  name: text("name").notNull(),
  manufacturer: text("manufacturer"), // 'Schneider', 'ABB', 'Socomec'
  model: text("model"), // 'PM5340', 'A44', etc.
  deviceType: text("device_type"), // 'energy_meter', 'power_meter'
  connectionType: text("connection_type"), // 'RS485', 'TCP'
  baudRate: integer("baud_rate").default(9600),
  parity: text("parity").default("N"), // 'N', 'E', 'O'
  status: text("status").default("offline"), // 'online', 'offline', 'error'
  detectedVia: text("detected_via"), // 'BACnet-object-scan', 'Modbus-discovery'
  lastSeen: timestamp("last_seen"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const modbusRegisterMaps = pgTable("modbus_register_maps", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => modbusDevices.id),
  parameterName: text("parameter_name").notNull(), // 'active_power_l1', 'voltage_l1'
  registerAddress: integer("register_address").notNull(),
  dataType: text("data_type").notNull(), // 'HOLDING', 'INPUT', 'COIL', 'DISCRETE'
  scaleFactor: doublePrecision("scale_factor").default(1.0),
  unit: text("unit"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// BACnet Object to Device mapping
export const bacnetObjectMappings = pgTable("bacnet_object_mappings", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  bacnetControllerId: integer("bacnet_controller_id").notNull().references(() => bacnetControllers.id),
  
  // BACnet object identification
  objectType: integer("object_type").notNull(), // 23 = Program, 0 = AI, 1 = AO, etc.
  objectInstance: integer("object_instance").notNull(), // 0, 1, 2, ...
  objectName: text("object_name").notNull(), // 'INPUT POWER [KW]', 'EM_01_Voltage [V]'
  
  // Meter grouping
  meterGroupKey: text("meter_group_key").notNull(), // '17800_VFD', '17800_EM_01'
  
  // Parameter classification
  parameterType: text("parameter_type"), // 'active_power', 'voltage', 'current', etc.
  parameterCategory: text("parameter_category"), // 'power', 'energy', 'voltage', etc.
  phase: text("phase"), // 'L1', 'L2', 'L3', 'TOTAL'
  
  // Mapping to device field
  mappedToField: text("mapped_to_field"), // 'power', 'voltage', 'current', 'energy', 'frequency'
  
  // Units and scaling
  units: text("units"), // 'kW', 'V', 'A', 'Hz'
  scaleFactor: doublePrecision("scale_factor").default(1.0),
  
  description: text("description"),
  enabled: boolean("enabled").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true, lastSeen: true, createdAt: true });
export const insertReadingSchema = createInsertSchema(readings).omit({ id: true, timestamp: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, timestamp: true, acknowledged: true, acknowledgedBy: true, acknowledgedAt: true });
export const insertThresholdSchema = createInsertSchema(thresholds).omit({ id: true, createdAt: true, updatedAt: true });

// BACnet/Modbus schemas
export const insertBacnetControllerSchema = createInsertSchema(bacnetControllers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertModbusDeviceSchema = createInsertSchema(modbusDevices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertModbusRegisterMapSchema = createInsertSchema(modbusRegisterMaps).omit({ id: true, createdAt: true });
export const insertBacnetObjectMappingSchema = createInsertSchema(bacnetObjectMappings).omit({ id: true, createdAt: true, updatedAt: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export type Reading = typeof readings.$inferSelect;
export type InsertReading = z.infer<typeof insertReadingSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type Threshold = typeof thresholds.$inferSelect;
export type InsertThreshold = z.infer<typeof insertThresholdSchema>;

// BACnet/Modbus types
export type BacnetController = typeof bacnetControllers.$inferSelect;
export type InsertBacnetController = z.infer<typeof insertBacnetControllerSchema>;

export type ModbusDevice = typeof modbusDevices.$inferSelect;
export type InsertModbusDevice = z.infer<typeof insertModbusDeviceSchema>;

export type ModbusRegisterMap = typeof modbusRegisterMaps.$inferSelect;
export type InsertModbusRegisterMap = z.infer<typeof insertModbusRegisterMapSchema>;

export type BacnetObjectMapping = typeof bacnetObjectMappings.$inferSelect;
export type InsertBacnetObjectMapping = z.infer<typeof insertBacnetObjectMappingSchema>;

// Request Types
export type CreateDeviceRequest = InsertDevice;
export type UpdateDeviceRequest = Partial<InsertDevice>;

export type CreateAlertRequest = InsertAlert;
export type AcknowledgeAlertRequest = { userId?: number };

// Response Types
export type DeviceResponse = Device;
export type ReadingResponse = Reading;
export type AlertResponse = Alert & { deviceName?: string }; // Joined with device name
