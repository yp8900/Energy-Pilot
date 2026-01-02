// Test Foreign Device Registration with Loytec LIOB-589
import dgram from 'dgram';

const PORT = 47808;
const DEVICE_IP = '192.168.1.47';
const LOCAL_IP = '192.168.1.35';

const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

console.log('🔍 Testing BACnet Foreign Device Registration...');
console.log(`📍 Target BBMD: ${DEVICE_IP}:${PORT}`);
console.log(`🖥️  Local IP: ${LOCAL_IP}\n`);

socket.on('error', (err) => {
  console.error('❌ Socket error:', err);
  socket.close();
});

socket.on('message', (msg, rinfo) => {
  console.log(`✅ Received response from ${rinfo.address}:${rinfo.port}`);
  console.log(`   Message length: ${msg.length} bytes`);
  console.log(`   Data (hex): ${msg.toString('hex')}`);
  
  // Parse BVLC header
  const bvlcType = msg[0];
  const bvlcFunction = msg[1];
  console.log(`   BVLC Type: 0x${bvlcType.toString(16)}`);
  console.log(`   BVLC Function: 0x${bvlcFunction.toString(16)}`);
  
  if (bvlcFunction === 0x00) {
    console.log('   ✅ BVLC-Result: Registration successful!');
  } else if (bvlcFunction === 0x0a) {
    console.log('   📢 Original-Broadcast-NPDU (potential Who-Is response)');
  }
});

socket.on('listening', () => {
  const address = socket.address();
  console.log(`✅ Socket listening on ${address.address}:${address.port}\n`);
  socket.setBroadcast(true);
  
  // Send Foreign Device Registration
  // BVLC Header: Type=0x81, Function=0x05 (Register-Foreign-Device), Length=0x0006, TTL=0xFFFF (65535 seconds)
  const registerFD = Buffer.from([
    0x81,           // BVLC Type: BACnet/IP
    0x05,           // BVLC Function: Register-Foreign-Device
    0x00, 0x06,     // BVLC Length: 6 bytes
    0xFF, 0xFF      // TTL: 65535 seconds
  ]);
  
  console.log('📤 Sending Foreign Device Registration...');
  socket.send(registerFD, PORT, DEVICE_IP, (err) => {
    if (err) {
      console.error('❌ Send error:', err);
    } else {
      console.log('✅ Registration request sent\n');
      console.log('⏳ Waiting for BVLC-Result response...\n');
    }
  });
  
  // After 3 seconds, send Who-Is
  setTimeout(() => {
    console.log('📤 Sending Who-Is as Foreign Device...');
    
    // BACnet Who-Is via BVLC Distribute-Broadcast-To-Network
    const whoIs = Buffer.from([
      0x81, 0x0b, 0x00, 0x0c,  // BVLC: Distribute-Broadcast-To-Network
      0x01, 0x20,               // NPDU
      0x00, 0x08,               // APDU: Who-Is
      0x09, 0x46, 0x88,         // Device ID low: 17800
      0x19, 0x46, 0x88          // Device ID high: 17800
    ]);
    
    socket.send(whoIs, PORT, DEVICE_IP, (err) => {
      if (err) {
        console.error('❌ Who-Is send error:', err);
      } else {
        console.log('✅ Who-Is sent via BBMD');
      }
    });
  }, 3000);
});

socket.bind(PORT, '0.0.0.0');

setTimeout(() => {
  console.log('\n⏱️  Test complete');
  console.log('\n💡 If no responses received:');
  console.log('   - Device may not support Foreign Device Registration');
  console.log('   - BBMD may not be enabled on device');
  console.log('   - Try discovering with other BACnet tools (YABE, BACnet Scanner)');
  socket.close();
  process.exit(0);
}, 10000);
