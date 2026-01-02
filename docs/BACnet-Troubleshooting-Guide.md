# BACnet Network Troubleshooting Guide

## Overview
This guide addresses the common BACnet protocol errors encountered during device discovery and provides solutions for network connectivity issues.

## Common Error: BacnetAbort - Reason:5

### What it means:
- **Reason 5** typically indicates `SEGMENTATION_NOT_SUPPORTED` or `BUFFER_OVERFLOW`
- The device cannot handle the APDU (Application Protocol Data Unit) size being requested
- This is common when trying to read properties from devices with limited capabilities

### Immediate Fixes Applied:
1. **Reduced APDU Size**: Changed from 1476 to 206 bytes for better compatibility
2. **Enhanced Error Handling**: Individual property reads with fallback logic
3. **Retry Logic**: Multiple attempts with exponential backoff
4. **Timeout Management**: 3-second timeout per property read

## Device ID 0 Issue

### Problem:
Many devices showing Device ID 0 instead of unique identifiers.

### Causes:
1. **Network Routing**: Devices may be on a different subnet
2. **Timing Issues**: Responses arriving after discovery timeout
3. **Protocol Mismatch**: Some devices use non-standard BACnet implementations

### Solutions:
1. **Targeted Discovery**: Enhanced to specifically target known devices (LIOB-585 at 172.16.12.60)
2. **Duplicate Filtering**: Prevents multiple entries for same device
3. **Extended Timeout**: Increased discovery time to 10 seconds

## Network Configuration Checklist

### 1. Network Interface Verification
```bash
# Run network diagnostics
npx tsx script/network-diagnostics.ts

# Check specific interfaces
ipconfig /all
```

### 2. BACnet Port Status
- **Port**: 47808 (UDP)
- **Status**: Must be available (not in use by other applications)
- **Firewall**: Windows Firewall must allow UDP 47808

### 3. Cross-Subnet Connectivity
Current network topology:
- **Client Machine**: 172.18.x.x (WiFi)
- **BACnet Devices**: 172.16.12.x (Wired network)

**Solution**: Ensure router allows broadcast packets between subnets or connect to same network.

## Device-Specific Troubleshooting

### LIOB-585 Controller (172.16.12.60, Device ID 7060)
- ✅ **Successfully Discovered**: Device responds properly to Who-Is
- ✅ **Enhanced Modbus Scanning**: 3 interfaces detected
- ⚠️ **Property Reading**: May timeout on some extended properties

### Generic BACnet Devices
- **Many devices at 172.16.12.x**: Showing Device ID 0
- **Possible Cause**: Network routing or device configuration
- **Recommendation**: Individual device testing

## Enhanced Error Handling Features

### 1. Safe Property Reading
- Individual try-catch blocks for each property
- Timeout protection (3 seconds per property)
- Graceful degradation when properties unavailable

### 2. Network Resilience
- Reduced APDU size for compatibility
- Retry logic with backoff
- Duplicate device filtering
- Enhanced logging for troubleshooting

### 3. Device Identification
- Skip enrichment for Device ID 0 (communication issues)
- Vendor-specific optimizations for Loytec devices
- Fallback device naming

## Deployment Recommendations

### For Test Device Migration:
1. **Network Connection**: Connect to 172.16.12.x network directly
2. **Firewall Configuration**: Ensure UDP 47808 is allowed
3. **Application Isolation**: Close other BACnet applications
4. **Gradual Testing**: Start with basic discovery, then add enrichment

### For Production Deployment:
1. **Network Topology**: Document network routing between subnets
2. **Device Inventory**: Create mapping of all BACnet device IDs
3. **Error Monitoring**: Implement logging for protocol errors
4. **Performance Tuning**: Adjust timeouts based on network latency

## Testing Commands

### Basic Network Test
```bash
# Test network diagnostics
npx tsx script/network-diagnostics.ts

# Test with BACnet discovery
npx tsx script/network-diagnostics.ts --with-bacnet-test

# BACnet only test
npx tsx script/network-diagnostics.ts --test-bacnet
```

### Device Connectivity Test
```bash
# Ping known devices
ping 172.16.12.60  # LIOB-585
ping 172.16.12.23  # Other device
ping 172.16.12.14  # Other device
```

### Port Availability Test
```bash
# Windows
netstat -an | findstr ":47808"

# Should return empty (port available)
```

## Error Log Analysis

### Current Status (Based on Latest Logs):
- ✅ **43 devices discovered** (good coverage)
- ✅ **LIOB-585 found** with correct Device ID 7060
- ⚠️ **BacnetAbort errors** during property enrichment
- ⚠️ **Multiple Device ID 0** entries (network routing issue)

### Action Items:
1. **Immediate**: Deploy enhanced error handling (already built)
2. **Short-term**: Verify network routing configuration
3. **Long-term**: Implement device-specific protocol optimizations

## Success Metrics

### What's Working:
- BACnet device discovery (43 devices found)
- Target device identification (LIOB-585)
- Enhanced Modbus capability detection
- Production build deployment

### What Needs Improvement:
- Device property enrichment (BacnetAbort errors)
- Network routing (Device ID 0 issues)
- Cross-subnet discovery reliability

## Support Information

For additional support:
1. **Check network diagnostics**: Run the diagnostic script
2. **Review device documentation**: Consult LIOB-585 manual for BACnet settings
3. **Monitor error patterns**: Look for recurring device addresses in errors
4. **Test incremental changes**: Deploy with minimal enrichment first

---

## Quick Fix Summary

The enhanced version includes:
- ✅ Robust error handling for BacnetAbort errors
- ✅ Reduced APDU size for compatibility (206 bytes)
- ✅ Individual property reading with timeout
- ✅ Duplicate device filtering
- ✅ Enhanced logging and diagnostics
- ✅ Network troubleshooting utilities

This should resolve the majority of protocol errors while maintaining full discovery functionality.