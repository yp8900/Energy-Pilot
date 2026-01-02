import sql from "mssql";
import { storage } from "./storage";

interface BMSConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
}

function log(message: string, source = "BMS") {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${source}: ${message}`);
}

export class BMSIntegration {
  private pool: sql.ConnectionPool | null = null;
  private config: BMSConfig;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: BMSConfig) {
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      this.pool = new sql.ConnectionPool({
        server: this.config.server,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        options: {
          encrypt: this.config.options?.encrypt ?? true,
          trustServerCertificate: this.config.options?.trustServerCertificate ?? true,
        },
        requestTimeout: 30000,
        connectionTimeout: 30000,
      });

      await this.pool.connect();
      log('Connected to BMS SQL Server database');
      return true;
    } catch (error) {
      log(`Failed to connect to BMS database: ${error}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      log('Disconnected from BMS database');
    }
  }

  getStatus() {
    return {
      connected: this.pool !== null,
      syncing: this.isRunning,
      config: {
        server: this.config.server,
        database: this.config.database
      }
    };
  }
}