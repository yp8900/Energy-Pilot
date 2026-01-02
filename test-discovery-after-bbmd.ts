/**
 * Test BACnet discovery after BBMD configuration
 */

import bacnet from 'bacstack';

const LOCAL_IP = '192.168.1.42';

console.log('\n==========================================');
console.log('🔍 BACNET DISCOVERY TEST (After BBMD Config)');
console.log('==========================================\n');
console.log(`Local Interface: ${LOCAL_IP}`);
console.log(`Listening on: UDP port 47808\n`);

// Create BACnet client
const client = new bacnet({
  port: 47808,
  interface: LOCAL_IP,
  broadcastAddress: '192.168.1.255',
  apduTimeout: 10000
});

let deviceCount = 0;

// Listen for I-Am responses
client.on('iAm', (device: any) => {
  deviceCount++;
  console.log(`\n✅ I-Am Response #${deviceCount} Received!`);
  console.log(`   Address: ${device.address}`);
  console.log(`   Device ID: ${device.deviceId}`);
  console.log(`   Max APDU: ${device.maxApdu}`);
  console.log(`   Segmentation: ${device.segmentation}`);
  console.log(`   Vendor ID: ${device.vendorId || 'Unknown'}`);
});

// Also listen for raw messages to see if ANYTHING comes back
client.on('message', (msg: any, rinfo: any) => {
  console.log(`📨 Raw message from ${rinfo.address}:${rinfo.port} (${msg.length} bytes)`);
});

console.log('📡 Sending Who-Is broadcasts...\n');

// Method 1: General broadcast
console.log('1️⃣ General broadcast (all networks)');
client.whoIs();

// Method 2: Direct to Loytec
console.log('2️⃣ Direct unicast to 192.168.1.33 (Device ID 17800)');
client.whoIs({ address: '192.168.1.33', lowLimit: 17800, highLimit: 17800 });

// Method 3: Subnet broadcast
console.log('3️⃣ Subnet broadcast (192.168.1.255)');
client.whoIs({ address: '192.168.1.255' });

console.log('\n⏳ Waiting 10 seconds for I-Am responses...\n');

setTimeout(() => {
  console.log('\n==========================================');
  if (deviceCount > 0) {
    console.log(`✅ SUCCESS! Discovered ${deviceCount} device(s)`);
    console.log('\n💡 BBMD configuration worked!');
    console.log('   Discovery is now functional.');
  } else {
    console.log('❌ No devices discovered');
    console.log('\n💡 Possible issues:');
    console.log('   1. BBMD IP not set correctly (should be 192.168.1.42)');
    console.log('   2. BACnet service not restarted after configuration');
    console.log('   3. Discovery still disabled in device settings');
    console.log('   4. Need to use manual device registration workaround');
  }
  console.log('==========================================\n');
  
  client.close();
  process.exit(deviceCount > 0 ? 0 : 1);
}, 10000);
