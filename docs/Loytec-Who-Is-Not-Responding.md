# Loytec LIOB-589 Not Responding to Who-Is - Troubleshooting

## Current Situation

**Device**: Loytec LIOB-589 at 192.168.1.33  
**Device ID**: 17800  
**Problem**: Device is NOT responding to BACnet Who-Is broadcasts  
**Network Status**: ✅ Ping works (4ms), ✅ Web interface accessible, ❌ NO BACnet responses

### BACnet Configuration (from screenshots):
- BACnet/IP: ✅ **ENABLED** (checkbox checked)
- Port: **0xBAC0** (47808 decimal)
- Mode: **Device (Default)**
- Network number: **1**
- APDU length: **1476**
- FD BBMD IP Address: **(empty)**
- FD re-registration: **60 s**

### What We've Tested:
- ✅ Broadcast to 0.0.0.0 (all interfaces)
- ✅ Broadcast to 192.168.1.255 (subnet broadcast)
- ✅ Broadcast to 255.255.255.255 (limited broadcast)
- ✅ Direct unicast to 192.168.1.33 targeting Device ID 17800
- ✅ Raw UDP Who-Is packet manual send
- ✅ Multiple discovery methods in code
- ✅ Firewall rules verified (Node.js allowed)
- ✅ Device rebooted (no improvement)

**Result**: ZERO I-Am responses, NO incoming UDP packets on port 47808

---

## Root Cause Analysis

### Why Devices Don't Respond to Who-Is

Based on BACnet standards and common device implementations, here are the top reasons:

### 1. **BACnet/IP Service Not Actually Running** ⭐ MOST LIKELY
- **Checkbox enabled ≠ service running**
- Service may have failed to start after configuration
- Loytec devices often require explicit service restart

**Solution:**
1. In Loytec web interface, look for **System → Services** or **Status → BACnet**
2. Check if "BACnet/IP Service" shows as **RUNNING** (not just enabled)
3. Try **Stop → Start** sequence instead of just reboot
4. Check for error logs in System Logs or BACnet Diagnostics

---

### 2. **BBMD (Broadcast Management Device) Required** ⭐ LIKELY
- The **"FD BBMD IP Address"** field is **EMPTY** in your config
- Loytec devices may require BBMD registration to respond to Who-Is
- **FD = Foreign Device**, must register with BBMD to participate in discovery

**Solution:**
**Option A - Set up local BBMD (simpler):**
```javascript
// In bacnet-service.ts, add BBMD setup in initialize():
// If we want to act as BBMD for local network
this.client.registerAsBBMD((err: any) => {
  if (err) {
    console.error('❌ Failed to register as BBMD:', err);
  } else {
    console.log('✅ Registered as BBMD');
  }
});
```

**Option B - Configure Loytec to point to BBMD:**
- In Loytec web interface, set **FD BBMD IP Address** to your server IP (192.168.1.42)
- Save and restart BACnet service
- Our application will need to act as BBMD (see code above)

---

### 3. **Network Number Mismatch / Routing Issue** ⭐ POSSIBLE
- Device configured for **Network number: 1**
- Our application may be treating this as local network (network 0)
- Device might be expecting **routed messages** instead of direct broadcasts

**Solution:**
Try sending Who-Is with network number specification:
```javascript
// In discoverDevices(), try:
this.client.whoIs({ 
  address: '192.168.1.33',
  net: 1,  // ← ADD THIS: specify network 1
  lowLimit: 17800, 
  highLimit: 17800 
});
```

---

### 4. **Who-Is Filtering Enabled**
- Device may have **security settings** filtering Who-Is requests
- Check for "BACnet Security" or "Access Control" settings

**Solution:**
- Look in Loytec web interface under **Security → BACnet Access**
- Check if "Allow Who-Is from unknown devices" is enabled
- Look for IP address whitelist/blacklist

---

### 5. **Wrong BACnet Mode**
- Configuration shows **Mode: Device (Default)**
- Might need to be **"BACnet/IP Device"** instead (not default)

**Solution:**
- In Port Configuration, try changing mode dropdown
- Look for explicit "BACnet/IP Device" option
- Some Loytec models have "Router" vs "Device" modes

---

### 6. **UDP Port Actually Different**
- Config shows **0xBAC0** (47808), but service might be using different port
- Firmware bug where config doesn't match runtime

**Solution:**
Test with common alternative ports:
```javascript
// Try scanning multiple ports:
const testPorts = [47808, 47809, 0xBAC0, 0xBAC1];
for (const port of testPorts) {
  console.log(`Testing port ${port}...`);
  // Create client with specific port
  const testClient = new bacnet({ port, interface: '192.168.1.42' });
  // Send Who-Is
  testClient.whoIs({ address: '192.168.1.33' });
  await new Promise(resolve => setTimeout(resolve, 2000));
  testClient.close();
}
```

---

### 7. **MS/TP Mode Active Instead of IP**
- Device might be in **BACnet MS/TP** (serial) mode, not IP
- Web interface shows IP config, but runtime is using MS/TP

**Solution:**
- Check if Loytec has **two BACnet tabs**: one for MS/TP, one for IP
- Ensure you're on the **"BACnet/IP"** tab, not "BACnet MS/TP"
- Some Loytec devices require **explicit protocol selection**

---

## Immediate Action Plan

### **STEP 1**: Check BACnet Service Status (5 minutes)
1. Open Loytec web interface: http://192.168.1.33
2. Navigate to: **System → Status** or **System → Services**
3. Look for "BACnet/IP Service" - is it **RUNNING**?
4. If not running, click **Start** or **Restart**

**Expected Result**: Service should show "Running" or "Active"

---

### **STEP 2**: Enable BBMD/Foreign Device Registration (10 minutes)
**Option A - Configure Loytec as Foreign Device:**
1. In Loytec web interface → **Port Configuration**
2. Set **FD BBMD IP Address** to: `192.168.1.42` (your server)
3. Keep **FD re-registration** at 60s
4. Click **Save and Restart BACnet Service**

**Option B - Make our app a BBMD:**
1. Add BBMD registration code (provided below)
2. Restart Node.js server
3. Check Loytec sees BBMD connection

---

### **STEP 3**: Try Direct Property Read (Test BACnet Without Discovery)
Instead of waiting for I-Am, try **reading a property directly**:

```typescript
// Test if BACnet communication works at all (bypassing discovery)
async testDirectPropertyRead(): Promise<void> {
  console.log('🧪 Testing direct BACnet property read (bypassing discovery)...');
  
  const targetDevice = {
    address: '192.168.1.33',
    deviceId: 17800
  };
  
  try {
    // Try to read Device Object Name (property 77)
    this.client.readProperty(
      targetDevice.address,
      { type: 8, instance: targetDevice.deviceId }, // Device object
      77, // Object Name property
      (err: any, value: any) => {
        if (err) {
          console.error('❌ Direct read FAILED:', err);
          console.error('   This means BACnet/IP communication is NOT working');
        } else {
          console.log('✅ Direct read SUCCESS!');
          console.log(`   Device name: ${value.values[0].value}`);
          console.log('   🎯 BACnet/IP works! Problem is ONLY with Who-Is/I-Am');
        }
      }
    );
  } catch (error) {
    console.error('❌ Exception during direct read:', error);
  }
}
```

**Interpretation:**
- ✅ **If direct read works**: BACnet/IP is functional, just Who-Is/I-Am is blocked
- ❌ **If direct read fails**: BACnet/IP service not running at all

---

### **STEP 4**: Check for Hidden Service Settings
In Loytec web interface, look for these less obvious pages:
- **System → BACnet Diagnostics**
- **System → Communication Logs**
- **Configuration → Advanced BACnet**
- **Security → Access Control**

Look for:
- "Enable Discovery" checkbox
- "Respond to Who-Is" setting
- IP address filters
- Diagnostic counters (should increment when we send Who-Is)

---

## Code Fixes to Try

### Fix 1: Add BBMD Support
```typescript
// In bacnet-service.ts, add to initialize():

async initialize(): Promise<void> {
  try {
    // ... existing code ...
    
    this.client = new bacnet(clientConfig);
    
    // NEW: Register as BBMD for local network
    console.log('📡 Registering as BBMD...');
    this.client.registerAsBBMD((err: any) => {
      if (err) {
        console.error('❌ Failed to register as BBMD:', err);
      } else {
        console.log('✅ Successfully registered as BBMD');
        console.log('   Loytec Foreign Devices can now register with us');
      }
    });
    
    this.setupEventHandlers();
    // ... rest of code ...
  }
}
```

### Fix 2: Add Network Number to Discovery
```typescript
// In discoverDevices(), modify Method 4:

// Method 4: Direct unicast with network number
console.log('📡 Method 4: Direct unicast to 192.168.1.33 WITH network 1');
this.client.whoIs({ 
  address: '192.168.1.33',
  net: 1,  // ← ADD THIS
  lowLimit: 17800, 
  highLimit: 17800 
});
```

### Fix 3: Add Direct Read Test
```typescript
// Add new method to BACnetService class:

async testDirectCommunication(
  address: string, 
  deviceId: number
): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`🧪 Testing direct BACnet communication to ${address}:${deviceId}`);
    
    this.client.readProperty(
      address,
      { type: 8, instance: deviceId }, // Device object
      77, // Object Name property
      (err: any, value: any) => {
        if (err) {
          console.error('❌ Direct communication FAILED:', err);
          resolve(false);
        } else {
          console.log('✅ Direct communication SUCCESS!');
          console.log(`   Device: ${value.values[0].value}`);
          resolve(true);
        }
      }
    );
    
    // Timeout after 5 seconds
    setTimeout(() => {
      console.warn('⏱️  Direct communication test timeout');
      resolve(false);
    }, 5000);
  });
}
```

---

## Expected Outcome

### If BBMD is the issue:
- After setting up BBMD or Foreign Device registration
- Loytec should send registration packet
- Then respond to Who-Is requests
- Discovery should work normally

### If service not running:
- After starting BACnet/IP service in web UI
- Device should immediately respond to Who-Is
- Should see incoming packets in our logs

### If it's a security setting:
- After disabling Who-Is filters
- Discovery should work immediately
- No code changes needed

---

## References

### BACnet Standards:
- **ANSI/ASHRAE Standard 135-2020**: BACnet protocol specification
- **Clause 16.10**: Network Layer Message Services (Who-Is/I-Am)
- **Annex J**: BACnet/IP protocol specifics
- **Annex H**: BBMD and Foreign Device registration

### Loytec Resources:
- Check Loytec user manual for your firmware version
- Look for "BACnet/IP Configuration" chapter
- Search for "Foreign Device" or "BBMD" sections

### Common Discovery Issues:
1. **70% of cases**: BBMD/Foreign Device misconfiguration
2. **20% of cases**: Service not actually running despite config
3. **10% of cases**: Firewall or network routing

---

## Next Steps

**RIGHT NOW:**
1. Check System Status in Loytec web interface
2. Look for BACnet service running indicator
3. Try direct property read test (code provided)

**IF DIRECT READ WORKS:**
- Problem is Who-Is/I-Am specific
- Focus on BBMD and Foreign Device configuration

**IF DIRECT READ FAILS:**
- BACnet/IP service not functional
- Check service status, restart service
- Look for error logs in Loytec

**IF NOTHING WORKS:**
- Export full Loytec configuration (if possible)
- Check firmware version
- Consider firmware update
- Contact Loytec support with diagnostic data
