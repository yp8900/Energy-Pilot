import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

// Import Auth routes registration
import { registerAuthRoutes } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // 2. Application Routes

  // --- Devices ---
  app.get(api.devices.list.path, async (req, res) => {
    const devices = await storage.getDevices();
    res.json(devices);
  });

  app.get(api.devices.get.path, async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ message: "Device not found" });
    res.json(device);
  });

  app.post(api.devices.create.path, async (req, res) => {
    try {
      const input = api.devices.create.input.parse(req.body);
      const device = await storage.createDevice(input);
      res.status(201).json(device);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(e.errors);
      throw e;
    }
  });

  app.put(api.devices.update.path, async (req, res) => {
    try {
      const input = api.devices.update.input.parse(req.body);
      const device = await storage.updateDevice(Number(req.params.id), input);
      res.json(device);
    } catch (e) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.delete(api.devices.delete.path, async (req, res) => {
    await storage.deleteDevice(Number(req.params.id));
    res.status(204).send();
  });

  // --- Readings ---
  app.get(api.readings.latest.path, async (req, res) => {
    const reading = await storage.getLatestReading(Number(req.params.id));
    if (!reading) return res.status(404).json({ message: "No readings found" });
    res.json(reading);
  });

  app.get(api.readings.history.path, async (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const readings = await storage.getReadings(Number(req.params.id), limit);
    res.json(readings);
  });

  app.post(api.readings.create.path, async (req, res) => {
    try {
      const input = api.readings.create.input.parse(req.body);
      const reading = await storage.createReading(input);
      res.status(201).json(reading);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(e.errors);
      throw e;
    }
  });

  // --- Alerts ---
  app.get(api.alerts.list.path, async (req, res) => {
    const status = req.query.status as 'active' | 'acknowledged' | 'all' | undefined;
    const alerts = await storage.getAlerts(status);
    res.json(alerts);
  });

  app.post(api.alerts.acknowledge.path, async (req, res) => {
    // In a real app, we'd get userId from req.user
    // const userId = req.user?.id;
    const alert = await storage.acknowledgeAlert(Number(req.params.id), undefined);
    res.json(alert);
  });

  // --- Analytics ---
  app.get(api.analytics.overview.path, async (req, res) => {
    const overview = await storage.getAnalyticsOverview();
    res.json(overview);
  });

  // Seed Data if empty
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const devices = await storage.getDevices();
  if (devices.length === 0) {
    console.log("Seeding database...");
    
    const device1 = await storage.createDevice({
      name: "Main Feeder PLC",
      type: "PLC",
      location: "Building A",
      ipAddress: "192.168.1.10",
      status: "online",
      config: { protocol: "Modbus TCP" }
    });

    const device2 = await storage.createDevice({
      name: "HVAC Unit 1",
      type: "Smart Meter",
      location: "Rooftop",
      status: "online",
      config: { protocol: "MQTT" }
    });

    const device3 = await storage.createDevice({
      name: "Assembly Line 4",
      type: "Sensor",
      location: "Production Floor",
      status: "offline",
      config: {}
    });

    // Seed readings
    await storage.createReading({
      deviceId: device1.id,
      power: 450.5,
      voltage: 400.2,
      current: 1120.5,
      energy: 15000.0,
      frequency: 50.0,
      powerFactor: 0.95
    });

    await storage.createReading({
      deviceId: device2.id,
      power: 120.3,
      voltage: 399.8,
      current: 300.2,
      energy: 5000.0,
      frequency: 50.0,
      powerFactor: 0.92
    });

    // Seed alerts
    await storage.createAlert({
      deviceId: device3.id,
      severity: "warning",
      message: "Device offline for > 1 hour"
    });

    await storage.createAlert({
      deviceId: device1.id,
      severity: "critical",
      message: "Voltage sag detected"
    });
    
    console.log("Database seeded.");
  }
}
