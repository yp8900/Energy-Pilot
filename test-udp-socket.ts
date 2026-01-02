// Test UDP socket to verify we can receive BACnet responses
import dgram from 'dgram';

const PORT = 47808;
const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

console.log('🔍 Testing UDP socket for BACnet/IP...');
console.log(`📡 Creating UDP socket on port ${PORT}`);

socket.on('error', (err) => {
  console.error('❌ Socket error:', err);
  socket.close();
});

socket.on('message', (msg, rinfo) => {
  console.log('✅ Received UDP message!');
  console.log(`   From: ${rinfo.address}:${rinfo.port}`);
  console.log(`   Size: ${msg.length} bytes`);
  console.log(`   Data (hex): ${msg.toString('hex').substring(0, 100)}...`);
});

socket.on('listening', () => {
  const address = socket.address();
  console.log(`✅ Socket listening on ${address.address}:${address.port}`);
  console.log(`🌐 Binding to all interfaces (0.0.0.0)`);
  
  // Enable broadcast
  socket.setBroadcast(true);
  console.log('✅ Broadcast enabled');
  
  console.log('\n📤 Sending BACnet Who-Is to 192.168.1.47...');
  
  // BACnet Who-Is message (simplified)
  const whoIs = Buffer.from([
    0x81, 0x0a, 0x00, 0x0c,  // BVLC header
    0x01, 0x20,              // NPDU
    0x00, 0x08,              // APDU: Who-Is
    0x09, 0x58, 0x46,        // Device ID low: 17800 (0x4588)
    0x19, 0x58, 0x46         // Device ID high: 17800
  ]);
  
  // Send to specific device
  socket.send(whoIs, PORT, '192.168.1.47', (err) => {
    if (err) {
      console.error('❌ Send error:', err);
    } else {
      console.log('✅ Who-Is sent to 192.168.1.47:47808');
    }
  });
  
  // Also send broadcast
  socket.send(whoIs, PORT, '192.168.1.255', (err) => {
    if (err) {
      console.error('❌ Broadcast send error:', err);
    } else {
      console.log('✅ Who-Is broadcast sent to 192.168.1.255:47808');
    }
  });
  
  console.log('\n⏳ Waiting 10 seconds for responses...\n');
});

socket.bind(PORT, '0.0.0.0');

setTimeout(() => {
  console.log('\n⏱️  10 seconds elapsed');
  console.log('🔍 If no messages received, check:');
  console.log('   1. BACnet/IP is enabled on LIOB-589');
  console.log('   2. Windows Firewall allows UDP 47808');
  console.log('   3. Device is responding to Who-Is requests');
  socket.close();
  process.exit(0);
}, 10000);
