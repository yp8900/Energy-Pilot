# Generic BACnet IP + Modbus Integration Roadmap for EnCharge

## Overview

This document outlines how to integrate **any BACnet IP device** that can read **Modbus RS485/TCP energy meters** into the EnCharge energy management system. The system will auto-discover BACnet devices, scan for Modbus capabilities, and automatically configure energy data reading regardless of the controller manufacturer.

## Architecture Diagram

```
[Energy Meters - Modbus RS485/TCP]
├── Schneider PM5340 (Modbus Address 1)
├── ABB A44 (Modbus Address 2)  
├── Socomec Diris A40 (Modbus Address 3)
└── Siemens PAC4200 (Modbus Address 4)
                │
                │ Modbus RS485/TCP
                ▼
[Any BACnet IP Controller/Gateway]
(Loytec, Honeywell, Johnson Controls, etc.)
        │         │
        │         │ BACnet IP
        │         ▼
        │    [BMS Database]
        │    (Optional)
        │
        │ Direct IP Read
        ▼
[EnCharge Dashboard]
```

## Implementation Roadmap

### Phase 1: Foundation Setup (Week 1)
**Goal**: Establish basic BACnet IP communication framework

#### 1.1 Install BACnet Libraries
```bash
npm install bacstack node-opcua modbus-serial
npm install --save-dev @types/bacstack
```

#### 1.2 Create BACnet Service Architecture
```typescript
// server/protocols/bacnet-service.ts
interface BACnetDevice {
  id: number;
  name: string;
  ipAddress: string;
  deviceId: number;
  maxApdu: number;
  segmentation: number;
  vendorId: number;
}

interface BACnetPoint {
  objectType: number;
  objectInstance: number;
  propertyId: number;
  description: string;
  unit: string;
}
```

#### 1.3 Generic BACnet Device Configuration
```typescript
// Vendor-agnostic BACnet configuration
const GENERIC_BACNET_CONFIG = {
  // Will be auto-detected during discovery
  vendorId: null, // Auto-detect from device
  segmentation: 3, // Both segmentation (standard)
  maxApdu: 1476,
  supportedServices: [
    'readProperty',
    'readPropertyMultiple',
    'writeProperty',
    'subscribeCOV'
  ]
};
```

### Phase 2: Device Discovery & Mapping (Week 2)
**Goal**: Auto-discover any BACnet IP devices and scan for Modbus capabilities

#### 2.1 BACnet Device Discovery & Vendor Detection
```typescript
class BACnetDiscovery {
  async discoverDevices(subnet: string): Promise<BACnetDevice[]>
  async identifyVendor(device: BACnetDevice): Promise<VendorInfo>
  async scanForModbusCapabilities(device: BACnetDevice): Promise<ModbusCapability[]>
  async readDeviceObjectList(device: BACnetDevice): Promise<BACnetPoint[]>
  async autoMapModbusDevices(device: BACnetDevice): Promise<ModbusDevice[]>
}

interface VendorInfo {
  vendorId: number;
  vendorName: string; // 'Loytec', 'Honeywell', 'Johnson Controls', etc.
  modelNumber?: string;
  firmwareVersion?: string;
  supportedProtocols: string[]; // ['BACnet', 'Modbus-TCP', 'Modbus-RTU']
}
```

#### 2.2 Automatic Modbus Device Detection
```typescript
interface ModbusDevice {
  bacnetControllerId: number; // Any BACnet controller
  modbusAddress: number; // 1-247
  deviceType: string; // 'energy_meter', 'power_meter'
  manufacturer: string; // Auto-detected: 'Schneider', 'ABB', 'Socomec'
  model: string; // Auto-detected: 'PM5340', 'A44', etc.
  registerMap: ModbusRegisterMap;
  detectedVia: string; // 'BACnet-object-scan', 'Modbus-discovery'
}

// Auto-detection strategies
class ModbusDetection {
  async scanBACnetObjectsForModbusData(device: BACnetDevice): Promise<ModbusDevice[]>
  async directModbusScan(device: BACnetDevice): Promise<ModbusDevice[]>
  async identifyMeterType(modbusResponse: any): Promise<MeterInfo>
}
```

#### 2.3 Database Schema Extension
```sql
-- Generic BACnet Controllers (any vendor)
CREATE TABLE BACnetControllers (
    id INT PRIMARY KEY IDENTITY,
    name VARCHAR(100) NOT NULL,
    ipAddress VARCHAR(15) NOT NULL,
    deviceId INT NOT NULL,
    port INT DEFAULT 47808,
    status VARCHAR(20) DEFAULT 'offline',
    lastSeen DATETIME,
    
    -- Auto-detected vendor information
    vendorId INT,
    vendorName VARCHAR(50), -- 'Loytec', 'Honeywell', 'Johnson Controls'
    modelNumber VARCHAR(50),
    firmwareVersion VARCHAR(20),
    maxApdu INT DEFAULT 1476,
    created_at DATETIME DEFAULT GETDATE()
);

-- Modbus devices connected to BACnet controllers
CREATE TABLE ModbusDevices (
    id INT PRIMARY KEY IDENTITY,
    bacnetControllerId INT REFERENCES BACnetControllers(id),
    modbusAddress INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(50),
    model VARCHAR(50),
    connectionType VARCHAR(10), -- 'RS485' or 'TCP'
    bauRate INT DEFAULT 9600,
    parity VARCHAR(1) DEFAULT 'N',
    status VARCHAR(20) DEFAULT 'offline',
    created_at DATETIME DEFAULT GETDATE()
);

-- Register mapping for different meter models
CREATE TABLE ModbusRegisterMap (
    id INT PRIMARY KEY IDENTITY,
    deviceId INT REFERENCES ModbusDevices(id),
    parameterName VARCHAR(50), -- 'active_power_l1', 'voltage_l1'
    registerAddress INT,
    dataType VARCHAR(20), -- 'HOLDING', 'INPUT'
    scaleFactor FLOAT DEFAULT 1.0,
    unit VARCHAR(10)
);
```

### Phase 3: Data Acquisition Engine (Week 3)
**Goal**: Implement dual-path data acquisition

#### 3.1 BACnet IP Data Reader
```typescript
class GenericBACnetDataReader {
  async readEnergyData(controller: BACnetDevice): Promise<EnergyReading[]>
  async readModbusDeviceData(controller: BACnetDevice, modbusAddr: number): Promise<ModbusReading>
  async subscribeToCOV(controller: BACnetDevice, points: BACnetPoint[]): Promise<void>
  async adaptToVendorSpecifics(controller: BACnetDevice): Promise<VendorAdapter>
}
```

#### 3.2 Flexible Data Source Manager
```typescript
class DataSourceManager {
  // Priority: Direct IP > BMS Database > Cached
  async getEnergyData(deviceId: number): Promise<EnergyReading> {
    // 1. Try direct BACnet IP read
    const directData = await this.readDirectIP(deviceId);
    if (directData) return directData;
    
    // 2. Fallback to BMS database
    const bmsData = await this.readFromBMS(deviceId);
    if (bmsData) return bmsData;
    
    // 3. Return last known cached value
    return await this.getCachedData(deviceId);
  }
}
```

#### 3.3 Protocol Bridge Service
```typescript
class ProtocolBridge {
  // Convert BACnet data to EnCharge format
  async convertBACnetToReading(bacnetData: any): Promise<Reading>
  
  // Convert Modbus data to EnCharge format
  async convertModbusToReading(modbusData: any): Promise<Reading>
  
  // Handle data quality flags
  async validateDataQuality(reading: Reading): Promise<boolean>
}
```

### Phase 4: Device Management Interface (Week 4)
**Goal**: Create UI for device configuration and monitoring

#### 4.1 Generic BACnet Controller Management Page
```typescript
// client/src/pages/BACnetControllers.tsx
interface ControllerConfig {
  name: string;
  ipAddress: string;
  deviceId: number;
  scanInterval: number;
  enableCOV: boolean;
  modbusDevices: ModbusDeviceConfig[];
}
```

#### 4.2 Modbus Device Discovery UI
```typescript
// Auto-scan for connected Modbus devices
const DiscoveryPanel = () => {
  const scanModbusDevices = async (controllerId: number) => {
    // Scan Modbus addresses 1-247
    // Identify device manufacturers
    // Auto-configure register maps
  };
};
```

#### 4.3 Real-time Device Status Dashboard
```typescript
const DeviceStatusGrid = () => {
  // Show BACnet controller health
  // Display Modbus device communication status
  // Real-time data quality indicators
  // Communication error logs
};
```

### Phase 5: Advanced Features (Week 5-6)

#### 5.1 Intelligent Device Recognition
```typescript
class DeviceRecognition {
  // Auto-identify meter models from Modbus register responses
  async identifyMeterModel(modbusData: any): Promise<string>
  
  // Load appropriate register map for identified device
  async loadRegisterMap(manufacturer: string, model: string): Promise<RegisterMap>
  
  // Validate data consistency across protocols
  async crossValidateData(bacnetData: any, modbusData: any): Promise<boolean>
}
```

#### 5.2 Communication Optimization
```typescript
class CommunicationOptimizer {
  // Batch BACnet read requests
  async optimizeBACnetReads(controllers: BACnetDevice[]): Promise<void>
  
  // Load balance Modbus polling
  async optimizeModbusPolling(devices: ModbusDevice[]): Promise<void>
  
  // Adaptive polling based on data change rates
  async adaptivePolling(device: any): Promise<number>
}
```

#### 5.3 Data Quality Management
```typescript
class DataQualityManager {
  // Detect and handle communication errors
  async handleCommunicationError(device: any, error: Error): Promise<void>
  
  // Data validation and filtering
  async validateReading(reading: Reading): Promise<boolean>
  
  // Automatic fallback strategies
  async executeFailover(deviceId: number): Promise<Reading>
}
```

### Phase 6: Integration & Testing (Week 7)

#### 6.1 End-to-End Testing
- BACnet device discovery
- Modbus device auto-configuration  
- Real-time data acquisition
- Failover scenarios
- Performance under load

#### 6.2 Documentation & Training
- API documentation
- Configuration guides
- Troubleshooting procedures
- Best practices

## Benefits of This Architecture

### ✅ **Flexible Data Sources**
- **Direct IP**: Low latency, real-time data from ALOTec controllers
- **BMS Database**: Leverages existing infrastructure, historical data
- **Automatic Failover**: Seamless switching between sources

### ✅ **Protocol Agnostic**
- **BACnet IP**: Industry standard building automation
- **Modbus RS485/TCP**: Universal energy meter protocol
- **SQL Database**: Enterprise integration compatibility

### ✅ **Scalable Architecture**
- **Multi-Controller Support**: Handle multiple ALOTec controllers
- **Device Auto-Discovery**: Automatically find and configure new devices
- **Load Balancing**: Optimize communication across multiple devices

### ✅ **Enterprise Ready**
- **Security**: Encrypted BACnet communications, secure database connections
- **Reliability**: Multiple data sources with automatic failover
- **Monitoring**: Real-time communication health monitoring

## Technology Stack

### Backend Services
```typescript
// BACnet IP Communication
import bacstack from 'bacstack';

// Modbus Protocol Support  
import ModbusRTU from 'modbus-serial';

// Database Integration
import mssql from 'mssql';

// Real-time Updates
import { Server as SocketServer } from 'socket.io';
```

### Frontend Components
```typescript
// Device Management
- BACnetControllerList
- ModbusDeviceGrid  
- ProtocolStatusPanel
- DataSourceSelector

// Configuration
- DeviceWizard
- RegisterMapEditor
- CommunicationSettings
- DiscoverySettings
```

## Implementation Timeline

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1 | Foundation | BACnet libraries, basic architecture |
| 2 | Discovery | Device discovery, database schema |  
| 3 | Data Acquisition | Dual-path reading, protocol bridge |
| 4 | UI Development | Device management interface |
| 5 | Advanced Features | Optimization, quality management |
| 6 | Integration | End-to-end testing, documentation |
| 7 | Deployment | Production deployment, training |

## Next Steps

1. **Start the server** and review current BMS integration
2. **Install BACnet libraries** and create basic service structure
3. **Configure ALOTec test device** for development
4. **Implement device discovery** for your specific network
5. **Build device management UI** for configuration

Would you like to start with any specific phase of this roadmap? We can begin with device discovery or the management interface based on your current priorities.