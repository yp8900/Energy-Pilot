// Direct BACnet read property test for Loytec LIOB-589
import bacnet from 'bacstack';

const client = new bacnet({
  port: 47808,
  interface: '192.168.1.35',
  broadcastAddress: '192.168.1.255',
  apduTimeout: 10000
});

console.log('🔍 Testing direct BACnet communication with LIOB-589...');
console.log('📍 Target: 192.168.1.47, Device ID: 17800');
console.log('🌐 Using interface: 192.168.1.35\n');

// Listen for I-Am responses
let receivedIAm = false;
client.on('iAm', (device: any) => {
  receivedIAm = true;
  console.log('✅ I-Am Response Received!');
  console.log(`   Address: ${device.address}`);
  console.log(`   Device ID: ${device.deviceId}`);
  console.log(`   Max APDU: ${device.maxApdu}`);
  console.log(`   Segmentation: ${device.segmentation}`);
  console.log(`   Vendor ID: ${device.vendorId}\n`);
});

// Listen for all messages
client.on('message', (msg: any, rinfo: any) => {
  console.log(`📨 Raw message from ${rinfo.address}:${rinfo.port} (${msg.length} bytes)`);
});

client.on('error', (err: any) => {
  console.error('❌ Error:', err);
});

console.log('📤 Sending Who-Is requests...\n');

// Method 1: Unicast to specific device with device ID
console.log('1️⃣  Unicast with Device ID 17800');
client.whoIs({ address: '192.168.1.47' }, 17800, 17800);

setTimeout(() => {
  // Method 2: Unicast without device ID
  console.log('2️⃣  Unicast without Device ID');
  client.whoIs({ address: '192.168.1.47' });
}, 2000);

setTimeout(() => {
  // Method 3: Try reading device object name directly
  console.log('3️⃣  Attempting direct ReadProperty for Device Object Name...');
  
  client.readProperty(
    { address: '192.168.1.47' },
    { type: 8, instance: 17800 }, // Device object
    77, // Object Name property
    (err: any, value: any) => {
      if (err) {
        console.error('❌ ReadProperty failed:', err.message);
      } else {
        console.log('✅ ReadProperty succeeded!');
        console.log('   Device Name:', value.values[0].value);
      }
    }
  );
}, 4000);

setTimeout(() => {
  console.log('\n📊 Test Results:');
  console.log(`   I-Am Response: ${receivedIAm ? '✅ Received' : '❌ Not received'}`);
  
  if (!receivedIAm) {
    console.log('\n🔍 Possible issues:');
    console.log('   1. Network number mismatch (device uses Network 1)');
    console.log('   2. Device requires Foreign Device Registration');
    console.log('   3. Firewall or network routing issue');
    console.log('   4. Device not responding to broadcast Who-Is');
    console.log('\n💡 Next steps:');
    console.log('   - Try ReadProperty directly (bypassing Who-Is)');
    console.log('   - Check if device requires BBMD registration');
    console.log('   - Verify device can be discovered by other BACnet tools');
  }
  
  client.close();
  process.exit(receivedIAm ? 0 : 1);
}, 12000);
