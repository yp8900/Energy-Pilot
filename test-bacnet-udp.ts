#!/usr/bin/env tsx
/**
 * BACnet UDP Port Test
 * Direct UDP test to port 47808 on your LIOB-585
 */

import * as dgram from 'dgram';

async function testBACnetPort() {
  console.log('🔍 Testing BACnet UDP port 47808 on 172.16.12.60...');
  
  const client = dgram.createSocket('udp4');
  
  // Create a targeted BACnet Who-Is request for device 7060
  // This targets your specific LIOB-585 device
  const whoIsPacket = Buffer.from([
    0x81, 0x0A, 0x00, 0x0C, // BACnet virtual link control (extended length)
    0x01, 0x20,             // Who-Is service
    0x09, 0x1B, 0x84,       // Low device range: 7060  
    0x19, 0x1B, 0x84        // High device range: 7060
  ]);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log('⏰ Timeout - no response in 5 seconds');
      client.close();
      resolve(false);
    }, 5000);
    
    // Listen for any response
    client.on('message', (msg, rinfo) => {
      console.log(`📨 Received response from ${rinfo.address}:${rinfo.port}`);
      console.log(`📊 Data: ${msg.toString('hex')}`);
      clearTimeout(timeout);
      client.close();
      resolve(true);
    });
    
    client.on('error', (err) => {
      console.error(`❌ UDP error: ${err}`);
      clearTimeout(timeout);
      client.close();
      reject(err);
    });
    
    // Send targeted Who-Is request for device 7060
    client.send(whoIsPacket, 47808, '172.16.12.60', (err) => {
      if (err) {
        console.error(`❌ Failed to send packet: ${err}`);
        clearTimeout(timeout);
        client.close();
        reject(err);
      } else {
        console.log('📡 Sent targeted Who-Is request for Device ID 7060 to 172.16.12.60:47808');
        console.log('⏳ Waiting for response...');
      }
    });
  });
}

// Run the test
testBACnetPort()
  .then((success) => {
    if (success) {
      console.log('✅ BACnet device responded! Your LIOB-585 is reachable on BACnet.');
    } else {
      console.log('❌ No BACnet response. Possible issues:');
      console.log('   • BACnet service might be disabled on the device');
      console.log('   • Different BACnet device instance or network number');
      console.log('   • Firewall blocking UDP port 47808');
    }
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
  });