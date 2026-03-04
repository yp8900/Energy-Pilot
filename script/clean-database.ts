/**
 * Clean PostgreSQL Database
 * Removes all data from devices, readings, and alerts tables
 */

import dotenv from "dotenv";
dotenv.config();

import { db } from "../server/db";
import { devices, readings, alerts } from "@shared/schema";

async function cleanDatabase() {
  if (!db) {
    console.error("❌ Database not connected");
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════╗");
  console.log("║     Database Cleanup Tool              ║");
  console.log("╚════════════════════════════════════════╝\n");

  console.log("⚠️  This will delete ALL data from:");
  console.log("   • devices");
  console.log("   • readings");
  console.log("   • alerts\n");

  try {
    console.log("🗑️  Deleting alerts...");
    await db.delete(alerts);
    
    console.log("🗑️  Deleting readings...");
    await db.delete(readings);
    
    console.log("🗑️  Deleting devices...");
    await db.delete(devices);

    console.log("\n✅ Database cleaned successfully!\n");
  } catch (error) {
    console.error("❌ Error cleaning database:", error);
    process.exit(1);
  }

  process.exit(0);
}

cleanDatabase();
