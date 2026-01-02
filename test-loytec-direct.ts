/**
 * Standalone test for direct BACnet communication with Loytec device
 * This tests if the Loytec device responds to property reads WITHOUT using Who-Is discovery
 */

import bacnet from 'bacstack';

const LOYTEC_IP = '192.168.1.33';
const LOYTEC_DEVICE_ID = 17800;
const LOCAL_IP = '192.168.1.42';

console.log('\n====================================');
console.log('🧪 LOYTEC DIRECT COMMUNICATION TEST');
console.log('====================================\n');
console.log(`Target Device: ${LOYTEC_IP}`);
console.log(`Device ID: ${LOYTEC_DEVICE_ID}`);
console.log(`Local Interface: ${LOCAL_IP}\n`);

// Create BACnet client
const client = new bacnet({
  port: 47808,
  interface: LOCAL_IP,
  broadcastAddress: '192.168.1.255',
  apduTimeout: 10000
});

console.log('✅ BACnet client created\n');

// Test: Read Device Object Name (property 77)
console.log('📡 TEST: Reading Device Object Name...');
console.log('   Object: Device 8:' + LOYTEC_DEVICE_ID);
console.log('   Property: Object Name (77)\n');

const timeout = setTimeout(() => {
  console.log('❌ TIMEOUT after 10 seconds - NO RESPONSE from device');
  console.log('\n💡 Possible causes:');
  console.log('   1. BACnet/IP service not running on Loytec');
  console.log('   2. Firewall blocking BACnet (UDP 47808)');
  console.log('   3. Device configured for different network number');
  console.log('   4. Device in MS/TP mode instead of BACnet/IP');
  console.log('   5. Who-Is filtering enabled\n');
  process.exit(1);
}, 10000);

client.readProperty(
  LOYTEC_IP,
  { type: 8, instance: LOYTEC_DEVICE_ID }, // Device object
  77, // Object Name property
  (err: any, value: any) => {
    clearTimeout(timeout);
    
    if (err) {
      console.log('❌ READ FAILED');
      console.log(`   Error: ${err.message || err}`);
      console.log('\n💡 Interpretation:');
      console.log('   → BACnet/IP communication is NOT working');
      console.log('   → Device is not responding to BACnet requests at all\n');
      
      console.log('🔧 Next steps:');
      console.log('   1. Check Loytec web interface: System → Status');
      console.log('   2. Verify "BACnet/IP Service" shows as RUNNING');
      console.log('   3. Try Stop → Start on the service');
      console.log('   4. Check for error logs in System Logs\n');
      
      process.exit(1);
    } else {
      console.log('✅ READ SUCCESSFUL!');
      console.log(`   Device Name: "${value.values[0].value}"`);
      console.log('\n🎯 Result: BACnet/IP communication is WORKING!');
      console.log('   → Device is responding to property reads');
      console.log('   → Problem is ONLY with Who-Is/I-Am discovery\n');
      
      console.log('💡 This means:');
      console.log('   • BACnet/IP service IS running');
      console.log('   • Network connectivity is good');
      console.log('   • Port 47808 is working');
      console.log('   • Problem: Device not responding to Who-Is broadcasts\n');
      
      console.log('🔧 Solutions to try:');
      console.log('   1. Set "FD BBMD IP Address" to 192.168.1.42 in Loytec');
      console.log('   2. Check for "Enable Discovery" or "Respond to Who-Is" setting');
      console.log('   3. Look for IP address filters blocking broadcasts');
      console.log('   4. Check if network number (currently 1) needs configuration\n');
      
      process.exit(0);
    }
  }
);

console.log('⏳ Waiting for response...\n');
