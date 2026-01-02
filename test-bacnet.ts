#!/usr/bin/env tsx
/**
 * BACnet Discovery Test Script
 * Direct test of BACnet service to debug the discovery issue
 */

// Wrap everything in async function
async function testBACnet() {
  // Test 1: Basic service import and method check
  console.log('🔍 Testing BACnet Service Import...');

try {
  const { bacnetService } = await import('./server/protocols/bacnet-service.js');
  
  console.log('✅ BACnet service imported successfully');
  console.log('📋 Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(bacnetService)));
  console.log('🟡 isRunning method exists:', typeof bacnetService.isRunning === 'function');
  console.log('🟡 Current running state:', bacnetService.isRunning());
  
  // Test 2: Initialize service
  console.log('\n🚀 Initializing BACnet service...');
  await bacnetService.initialize();
  console.log('✅ Service initialized');
  console.log('🟢 Service running:', bacnetService.isRunning());
  
  // Test 3: Target-specific device discovery
  console.log('\n🎯 Testing direct device discovery...');
  console.log('📡 Targeting your LIOB-585 at 172.16.12.60');
  
  // Try targeted discovery with a longer timeout
  const devices = await bacnetService.discoverDevices('172.16.12.60/32');
  console.log(`✅ Discovery completed. Found ${devices.length} devices:`);
  
  if (devices.length > 0) {
    devices.forEach(device => {
      console.log(`📟 Device: ${device.name} (ID: ${device.deviceId}) at ${device.address}`);
    });
  } else {
    console.log('❌ No BACnet devices found');
    
    // Try different approach - check common BACnet ports
    console.log('\n🔍 Testing BACnet connectivity...');
    console.log('📡 Standard BACnet UDP port: 47808');
    console.log('📡 Your device IP: 172.16.12.60');
  }
  
  // Test 4: Shutdown
  console.log('\n🛑 Shutting down service...');
  await bacnetService.shutdown();
  console.log('✅ Service shut down');
  
} catch (error) {
  console.error('❌ BACnet service test failed:', error);
}
}

// Run the test
testBACnet();