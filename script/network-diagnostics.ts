#!/usr/bin/env node

/**
 * BACnet Network Diagnostics Tool
 * 
 * This script helps diagnose BACnet network connectivity issues
 * and provides recommendations for network configuration.
 */

import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface NetworkInterface {
  name: string;
  address: string;
  netmask: string;
  family: string;
  cidr: string | null;
}

interface DiagnosticResult {
  interfaces: NetworkInterface[];
  bacnetPort: boolean;
  connectivity: { [key: string]: boolean };
  recommendations: string[];
}

class NetworkDiagnostics {
  private knownBACnetDevices = [
    '172.16.12.60', // LIOB-585
    '172.16.12.23',
    '172.16.12.14',
    '172.16.12.84'
  ];

  async runDiagnostics(): Promise<DiagnosticResult> {
    console.log('🔧 Running BACnet Network Diagnostics...\n');

    const result: DiagnosticResult = {
      interfaces: [],
      bacnetPort: false,
      connectivity: {},
      recommendations: []
    };

    // 1. Check network interfaces
    result.interfaces = this.getNetworkInterfaces();
    this.displayNetworkInterfaces(result.interfaces);

    // 2. Check if BACnet port is available
    result.bacnetPort = await this.checkBACnetPort();
    console.log(`📡 BACnet Port 47808: ${result.bacnetPort ? '✅ Available' : '❌ In Use/Blocked'}\n`);

    // 3. Test connectivity to known devices
    console.log('🔍 Testing connectivity to known BACnet devices...');
    for (const ip of this.knownBACnetDevices) {
      result.connectivity[ip] = await this.pingDevice(ip);
      console.log(`   ${ip}: ${result.connectivity[ip] ? '✅ Reachable' : '❌ Unreachable'}`);
    }
    console.log('');

    // 4. Generate recommendations
    result.recommendations = this.generateRecommendations(result);
    this.displayRecommendations(result.recommendations);

    return result;
  }

  private getNetworkInterfaces(): NetworkInterface[] {
    const interfaces: NetworkInterface[] = [];
    const nets = os.networkInterfaces();

    for (const [name, addrs] of Object.entries(nets)) {
      if (!addrs) continue;
      
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          interfaces.push({
            name,
            address: addr.address,
            netmask: addr.netmask,
            family: addr.family,
            cidr: addr.cidr
          });
        }
      }
    }

    return interfaces;
  }

  private displayNetworkInterfaces(interfaces: NetworkInterface[]): void {
    console.log('🌐 Network Interfaces:');
    interfaces.forEach(iface => {
      console.log(`   ${iface.name}: ${iface.address}/${this.cidrFromNetmask(iface.netmask)}`);
    });
    console.log('');
  }

  private cidrFromNetmask(netmask: string): number {
    return netmask.split('.').map(octet => 
      parseInt(octet).toString(2).split('1').length - 1
    ).reduce((sum, bits) => sum + bits, 0);
  }

  private async checkBACnetPort(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('netstat -an | findstr ":47808"');
        return stdout.trim().length === 0;
      } else {
        const { stdout } = await execAsync('netstat -an | grep :47808');
        return stdout.trim().length === 0;
      }
    } catch {
      return true; // Assume available if netstat fails
    }
  }

  private async pingDevice(ip: string): Promise<boolean> {
    try {
      const pingCmd = process.platform === 'win32' 
        ? `ping -n 1 -w 1000 ${ip}`
        : `ping -c 1 -W 1 ${ip}`;
      
      const { stdout, stderr } = await execAsync(pingCmd);
      return !stderr && (
        stdout.includes('Reply from') || 
        stdout.includes('1 packets transmitted, 1 received')
      );
    } catch {
      return false;
    }
  }

  private generateRecommendations(result: DiagnosticResult): string[] {
    const recommendations: string[] = [];

    // Check if on correct network
    const hasCorrectNetwork = result.interfaces.some(iface => 
      iface.address.startsWith('172.16.12.')
    );

    if (!hasCorrectNetwork) {
      recommendations.push(
        'Connect to the 172.16.12.x network where the BACnet devices are located'
      );
    }

    // Check connectivity
    const unreachableDevices = Object.entries(result.connectivity)
      .filter(([ip, reachable]) => !reachable)
      .map(([ip]) => ip);

    if (unreachableDevices.length > 0) {
      recommendations.push(
        `Unable to reach devices: ${unreachableDevices.join(', ')}. Check network connectivity.`
      );
    }

    // Port issues
    if (!result.bacnetPort) {
      recommendations.push(
        'BACnet port 47808 is in use. Close other BACnet applications or use a different port.'
      );
    }

    // Cross-subnet routing
    const hasOtherNetworks = result.interfaces.some(iface => 
      !iface.address.startsWith('172.16.12.') && 
      !iface.address.startsWith('127.') &&
      !iface.address.startsWith('169.254.')
    );

    if (hasOtherNetworks && hasCorrectNetwork) {
      recommendations.push(
        'Multiple networks detected. Ensure BACnet broadcast packets can reach 172.16.12.x subnet.'
      );
    }

    // Firewall
    recommendations.push(
      'Verify Windows Firewall allows UDP traffic on port 47808'
    );

    if (recommendations.length === 0) {
      recommendations.push('✅ Network configuration appears correct for BACnet communication');
    }

    return recommendations;
  }

  private displayRecommendations(recommendations: string[]): void {
    console.log('💡 Recommendations:');
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    console.log('');
  }
}

// Enhanced BACnet connection test
class BACnetConnectionTest {
  async testBACnetDiscovery(): Promise<void> {
    console.log('🔬 Testing BACnet Discovery...\n');

    try {
      // Import bacstack dynamically to avoid module issues
      const bacnet = require('bacstack');
      
      const client = new bacnet({
        maxApdu: 206,
        segmentation: 3,
        timeout: 3000,
        retry: 1
      });

      console.log('📡 Sending Who-Is broadcast...');
      
      const devices: any[] = [];
      const timeout = setTimeout(() => {
        console.log(`\n🔍 Discovery completed. Found ${devices.length} devices.\n`);
        client.close();
        process.exit(0);
      }, 8000);

      client.on('iAm', (device: any) => {
        devices.push(device);
        console.log(`   📡 Found: ${device.address} (ID: ${device.deviceId}, APDU: ${device.maxApdu})`);
      });

      client.whoIs();

    } catch (error) {
      console.error('❌ BACnet test failed:', error);
      console.log('\n💡 Try running: npm install bacstack\n');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test-bacnet')) {
    const test = new BACnetConnectionTest();
    await test.testBACnetDiscovery();
  } else {
    const diagnostics = new NetworkDiagnostics();
    await diagnostics.runDiagnostics();
    
    if (args.includes('--with-bacnet-test')) {
      console.log('\n' + '='.repeat(60) + '\n');
      const test = new BACnetConnectionTest();
      await test.testBACnetDiscovery();
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { NetworkDiagnostics, BACnetConnectionTest };