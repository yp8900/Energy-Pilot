/**
 * Test script to verify meter grouping logic
 * Tests the new single-device grouping for VFD parameters
 */

// Test data simulating the 10 VFD parameters
const testObjects = [
  { deviceId: 17800, objectName: 'INPUT POWER [KW]', objectType: 'Type23', objectInstance: 0 },
  { deviceId: 17800, objectName: 'INPUT POWER [HP]', objectType: 'Type23', objectInstance: 1 },
  { deviceId: 17800, objectName: 'MOTOR VOLTAGE\n', objectType: 'Type23', objectInstance: 2 },
  { deviceId: 17800, objectName: 'FREQUENCY\n', objectType: 'Type23', objectInstance: 4 },
  { deviceId: 17800, objectName: 'MOTOR CURRENT', objectType: 'Type23', objectInstance: 5 },
  { deviceId: 17800, objectName: 'FREQUENCY [%]', objectType: 'Type23', objectInstance: 6 },
  { deviceId: 17800, objectName: 'TORQUE [NM]', objectType: 'Type23', objectInstance: 7 },
  { deviceId: 17800, objectName: 'SPEED [RPM]', objectType: 'Type23', objectInstance: 8 },
  { deviceId: 17800, objectName: 'TORQUE [%]', objectType: 'Type23', objectInstance: 9 },
  { deviceId: 17800, objectName: 'DC LINK VOLTAGE', objectType: 'Type23', objectInstance: 10 },
];

// Extract meter info for each object
console.log('\n📊 Testing Meter Extraction Logic:\n');
console.log('═'.repeat(80));

for (const obj of testObjects) {
  const name = obj.objectName;
  
  // Test for explicit prefixes
  const meterMatch = name.match(/^meter[\s_-]*(\d+)/i);
  const emMatch = name.match(/^em[\s_-]*(\d+)/i);
  const vfdMatch = name.match(/^(vfd|drive|inverter)[\s_-]*(\d+)/i);
  
  const hasPrefix = !!(meterMatch || emMatch || vfdMatch);
  
  console.log(`Object: ${obj.objectType}:${obj.objectInstance}`);
  console.log(`  Name: "${name}"`);
  console.log(`  Has Explicit Prefix: ${hasPrefix ? '✅ YES' : '❌ NO'}`);
  console.log(`  Result: ${hasPrefix ? 'Group by prefix' : 'Group as single device'}`);
  console.log('─'.repeat(80));
}

console.log('\n🎯 Expected Outcome:');
console.log('  ❌ NO explicit prefixes found in any object');
console.log('  ✅ All 10 parameters should be grouped as ONE device');
console.log('  ✅ Device type: VFD (detected from motor/frequency/speed/torque keywords)');
console.log('  ✅ Meter name: "VFD (Device 17800)"\n');

// Test device type detection
console.log('\n🔍 Testing Device Type Detection:\n');
console.log('═'.repeat(80));

const namesCombined = testObjects.map(o => o.objectName.toLowerCase()).join(' ');
console.log(`Combined names: "${namesCombined.substring(0, 100)}..."`);

let deviceType = 'Unknown';
if (namesCombined.includes('motor') || namesCombined.includes('frequency') || 
    namesCombined.includes('speed') || namesCombined.includes('torque')) {
  deviceType = 'VFD';
} else if (namesCombined.includes('kwh') || namesCombined.includes('energy')) {
  deviceType = 'Energy Meter';
} else if (namesCombined.includes('power') && namesCombined.includes('voltage') && namesCombined.includes('current')) {
  deviceType = 'Power Meter';
}

console.log(`Detected Device Type: ${deviceType}`);
console.log(`Final Meter Name: "${deviceType} (Device 17800)"`);
console.log('═'.repeat(80));

// Test with explicit prefixes
console.log('\n\n📊 Testing with Explicit Prefixes (Multi-Meter Scenario):\n');
console.log('═'.repeat(80));

const multiMeterObjects = [
  { deviceId: 17800, objectName: 'Meter1_ActivePower', objectInstance: 0 },
  { deviceId: 17800, objectName: 'Meter1_Voltage_L1', objectInstance: 1 },
  { deviceId: 17800, objectName: 'Meter2_ActivePower', objectInstance: 10 },
  { deviceId: 17800, objectName: 'Meter2_Voltage_L1', objectInstance: 11 },
  { deviceId: 17800, objectName: 'VFD1_MotorSpeed', objectInstance: 20 },
  { deviceId: 17800, objectName: 'VFD1_Torque', objectInstance: 21 },
];

for (const obj of multiMeterObjects) {
  const name = obj.objectName;
  
  const meterMatch = name.match(/^meter[\s_-]*(\d+)/i);
  const vfdMatch = name.match(/^(vfd|drive|inverter)[\s_-]*(\d+)/i);
  
  let meterName = 'undefined';
  if (meterMatch) {
    meterName = `Meter${meterMatch[1]}`;
  } else if (vfdMatch) {
    meterName = `${vfdMatch[1].toUpperCase()}${vfdMatch[2]}`;
  }
  
  console.log(`Object: ${obj.objectInstance} - "${name}"`);
  console.log(`  Extracted Meter: ${meterName}`);
  console.log('─'.repeat(80));
}

console.log('\n🎯 Expected Outcome:');
console.log('  ✅ 3 separate meters: "Meter1", "Meter2", "VFD1"');
console.log('  ✅ Meter1: 2 parameters (ActivePower, Voltage_L1)');
console.log('  ✅ Meter2: 2 parameters (ActivePower, Voltage_L1)');
console.log('  ✅ VFD1: 2 parameters (MotorSpeed, Torque)\n');
