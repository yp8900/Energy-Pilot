// Test file to verify BACnet service integration

import { bacnetService } from './protocols/bacnet-service';

async function testBACnetService() {
  console.log('🧪 Testing BACnet Service...');
  
  try {
    // Initialize service
    console.log('1. Initializing BACnet service...');
    await bacnetService.initialize();
    
    // Test device discovery
    console.log('2. Starting device discovery...');
    const devices = await bacnetService.discoverDevices();
    
    console.log(`3. Discovery results: Found ${devices.length} devices`);
    
    if (devices.length > 0) {
      devices.forEach((device, index) => {
        console.log(`   Device ${index + 1}:`);
        console.log(`     Name: ${device.name}`);
        console.log(`     IP: ${device.ipAddress}`);
        console.log(`     Vendor: ${device.vendorName || 'Unknown'}`);
        console.log(`     Model: ${device.modelNumber || 'Unknown'}`);
        console.log(`     Device ID: ${device.deviceId}`);
        console.log(`     Status: ${device.status}`);
        console.log('');
      });
      
      // Test Modbus capability scanning on first device
      console.log('4. Testing Modbus capability scanning...');
      const capabilities = await bacnetService.scanForModbusCapabilities(devices[0]);
      console.log(`   Found ${capabilities.length} Modbus capabilities:`);
      capabilities.forEach(cap => {
        console.log(`     ${cap.protocol}: ${cap.supported ? 'Supported' : 'Not Supported'}`);
      });
    } else {
      console.log('   No devices found. This might be because:');
      console.log('   - No BACnet devices on network');
      console.log('   - Firewall blocking UDP port 47808');
      console.log('   - Devices not responding to whoIs broadcasts');
    }
    
    // Display service status
    console.log('5. Service status:');
    const status = bacnetService.getStatus();
    console.log(`   Running: ${status.running}`);
    console.log(`   Discovered devices: ${status.discoveredDevices}`);
    
    console.log('✅ BACnet service test completed successfully!');
    
  } catch (error) {
    console.error('❌ BACnet service test failed:', error);
  } finally {
    // Cleanup
    await bacnetService.shutdown();
  }
}

// Only run test if this file is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this file is being run directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('test-bacnet.ts');

if (isMainModule) {
  testBACnetService().catch(console.error);
}

export { testBACnetService };