/**
 * Direct BACnet Test for Loytec LIOB-589
 * Tests connectivity and object reading from Device 17800 at 192.168.1.47
 */

import bacnet from 'bacstack';

const TARGET_IP = '192.168.1.47';
const TARGET_DEVICE_ID = 17800;
const LOCAL_INTERFACE = '192.168.1.33';

console.log('\n🔍 BACnet Direct Connection Test for Loytec LIOB-589\n');
console.log(`📍 Target Device: ${TARGET_IP} (Device ID: ${TARGET_DEVICE_ID})`);
console.log(`🖥️  Local Interface: ${LOCAL_INTERFACE}\n`);

const client = new bacnet({
  port: 47808,
  interface: LOCAL_INTERFACE,
  broadcastAddress: '192.168.1.255',
  apduTimeout: 10000
});

let deviceFound = false;

// Listen for I-Am responses
client.on('iAm', (device: any) => {
  console.log('✅ Device Response Received!');
  console.log(`   Device ID: ${device.deviceId}`);
  console.log(`   Address: ${device.address}`);
  console.log(`   Max APDU: ${device.maxApdu}`);
  console.log(`   Segmentation: ${device.segmentation}`);
  console.log(`   Vendor ID: ${device.vendorId}\n`);
  
  if (device.deviceId === TARGET_DEVICE_ID) {
    deviceFound = true;
    console.log('🎯 Target Device Found! Reading object list...\n');
    readObjectList(device.address);
  }
});

// Listen for errors
client.on('error', (error: any) => {
  console.error('❌ BACnet Error:', error.message);
});

// Test 1: Who-Is to specific device
console.log('📡 Test 1: Unicast Who-Is to specific Device ID...');
client.whoIs({
  address: TARGET_IP,
  lowLimit: TARGET_DEVICE_ID,
  highLimit: TARGET_DEVICE_ID
});

// Test 2: Who-Is to specific IP (any device)
setTimeout(() => {
  console.log('📡 Test 2: Unicast Who-Is to IP (any device ID)...');
  client.whoIs({ address: TARGET_IP });
}, 2000);

// Test 3: Broadcast Who-Is
setTimeout(() => {
  console.log('📡 Test 3: Subnet Broadcast Who-Is...');
  client.whoIs({
    address: '192.168.1.255',
    lowLimit: TARGET_DEVICE_ID,
    highLimit: TARGET_DEVICE_ID
  });
}, 4000);

// Test 4: Read Device Name directly (if we know it responds)
setTimeout(() => {
  if (!deviceFound) {
    console.log('📡 Test 4: Direct Read Property (Device Name)...');
    client.readProperty(
      TARGET_IP,
      { type: 8, instance: TARGET_DEVICE_ID }, // Device object
      77, // object-name property
      (err: any, value: any) => {
        if (err) {
          console.error('❌ Read Property Failed:', err.message);
          console.log('\n⚠️  Possible Issues:');
          console.log('   1. BACnet/IP not enabled on device');
          console.log('   2. Device ID incorrect (not 17800)');
          console.log('   3. Firewall blocking UDP port 47808');
          console.log('   4. Device on different network segment');
          console.log('\n💡 Recommended Actions:');
          console.log('   1. Access Loytec web interface: http://192.168.1.47');
          console.log('   2. Enable BACnet/IP service');
          console.log('   3. Verify Device ID is 17800');
          console.log('   4. Confirm UDP port 47808 is open');
        } else {
          console.log('✅ Device Responded!');
          console.log(`   Device Name: ${value.values[0].value}`);
          deviceFound = true;
          readObjectList(TARGET_IP);
        }
      }
    );
  }
}, 6000);

// Function to read object list
function readObjectList(address: string) {
  console.log('📋 Reading object-list property...');
  
  client.readProperty(
    address,
    { type: 8, instance: TARGET_DEVICE_ID }, // Device object
    76, // object-list property
    (err: any, value: any) => {
      if (err) {
        console.error('❌ Failed to read object-list:', err.message);
        console.log('   This might be a large list. Trying read-property-multiple...\n');
        readObjectListMultiple(address);
      } else {
        console.log(`✅ Object List Retrieved: ${value.values.length} objects`);
        
        // Show first 10 objects
        const objectTypes: { [key: number]: string } = {
          0: 'AI', 1: 'AO', 2: 'AV', 3: 'BI', 4: 'BO', 5: 'BV', 19: 'MSV', 8: 'Device'
        };
        
        console.log('\n📦 Sample Objects (first 10):');
        value.values.slice(0, 10).forEach((obj: any, index: number) => {
          const typeName = objectTypes[obj.value.type] || `Type${obj.value.type}`;
          console.log(`   ${index + 1}. ${typeName}:${obj.value.instance}`);
        });
        
        console.log(`\n... and ${value.values.length - 10} more objects\n`);
        
        // Read a sample object name
        if (value.values.length > 0) {
          const sampleObj = value.values[1]; // Skip device object
          readSampleObject(address, sampleObj.value);
        }
      }
    }
  );
}

// Alternative: Read with read-property-multiple
function readObjectListMultiple(address: string) {
  const requestArray = [{
    objectId: { type: 8, instance: TARGET_DEVICE_ID },
    properties: [{ id: 76 }] // object-list
  }];
  
  client.readPropertyMultiple(address, requestArray, (err: any, value: any) => {
    if (err) {
      console.error('❌ Read Property Multiple also failed:', err.message);
      cleanup();
    } else {
      console.log('✅ Object List Retrieved via RPM');
      console.log(`   Total objects: ${value.values[0].values[0].values.length}\n`);
      cleanup();
    }
  });
}

// Read a sample object to test object reading
function readSampleObject(address: string, objectId: any) {
  console.log(`📖 Reading sample object: Type ${objectId.type}, Instance ${objectId.instance}`);
  
  const requestArray = [{
    objectId: objectId,
    properties: [
      { id: 77 }, // object-name
      { id: 85 }, // present-value
      { id: 28 }  // description
    ]
  }];
  
  client.readPropertyMultiple(address, requestArray, (err: any, value: any) => {
    if (err) {
      console.error('❌ Failed to read object properties:', err.message);
    } else {
      console.log('✅ Sample Object Properties:');
      value.values[0].values.forEach((prop: any) => {
        const propNames: { [key: number]: string } = {
          77: 'Object Name',
          85: 'Present Value',
          28: 'Description'
        };
        const propName = propNames[prop.id] || `Property ${prop.id}`;
        console.log(`   ${propName}: ${prop.values[0].value}`);
      });
    }
    
    console.log('\n🎉 Test Complete! Your device is BACnet-ready.\n');
    cleanup();
  });
}

// Cleanup and exit
function cleanup() {
  setTimeout(() => {
    console.log('🛑 Closing BACnet client...\n');
    client.close();
    process.exit(deviceFound ? 0 : 1);
  }, 2000);
}

// Exit after 12 seconds if no response
setTimeout(() => {
  if (!deviceFound) {
    console.log('\n⏱️  Timeout: No response from device after 12 seconds\n');
    console.log('❌ Device Not Found or Not Responding\n');
    console.log('⚠️  Troubleshooting Steps:');
    console.log('   1. Verify device is powered on and network cable connected');
    console.log('   2. Ping test: ping 192.168.1.47');
    console.log('   3. Access web interface: http://192.168.1.47');
    console.log('   4. Enable BACnet/IP service in device settings');
    console.log('   5. Check Device ID (should be 17800)');
    console.log('   6. Verify UDP port 47808 is not blocked\n');
    cleanup();
  }
}, 12000);
