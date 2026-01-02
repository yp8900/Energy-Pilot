// Quick test script for BACnet discovery on local network
import bacnet from 'bacstack';

const client = new bacnet({
  port: 47808,
  interface: '0.0.0.0',
  broadcastAddress: '255.255.255.255',
  adpuTimeout: 6000
});

console.log('🔍 Starting BACnet discovery test...');
console.log('📡 Listening on port 47808');
console.log('🌐 Targeting subnet: 192.168.1.x\n');

const discoveredDevices: any[] = [];

// Listen for I-Am responses
client.on('iAm', (device: any) => {
  console.log('✅ Device discovered!');
  console.log(`   IP Address: ${device.address}`);
  console.log(`   Device ID: ${device.deviceId}`);
  console.log(`   Max APDU: ${device.maxApdu}`);
  console.log(`   Segmentation: ${device.segmentation}`);
  console.log(`   Vendor ID: ${device.vendorId}\n`);
  
  discoveredDevices.push(device);
});

// Send Who-Is requests
console.log('📤 Sending targeted Who-Is to 192.168.1.47...');
client.whoIs({ address: '192.168.1.47' });

console.log('📤 Sending broadcast Who-Is to 192.168.1.255...');
client.whoIs({ address: '192.168.1.255' });

console.log('📤 Sending general broadcast Who-Is...');
client.whoIs();

console.log('\n⏳ Waiting 15 seconds for responses...\n');

// Wait 15 seconds then show results
setTimeout(() => {
  console.log('\n🎯 Discovery Results:');
  console.log(`   Total devices found: ${discoveredDevices.length}`);
  
  if (discoveredDevices.length === 0) {
    console.log('\n❌ No devices found. Troubleshooting tips:');
    console.log('   1. Verify device is on same network (192.168.1.x)');
    console.log('   2. Check BACnet/IP is enabled on device (port 47808)');
    console.log('   3. Verify no firewall blocking UDP port 47808');
    console.log('   4. Ensure device network number matches (if configured)');
    console.log('   5. Try pinging device: ping 192.168.1.47');
  }
  
  process.exit(0);
}, 15000);
