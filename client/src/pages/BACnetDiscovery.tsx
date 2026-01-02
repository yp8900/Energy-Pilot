import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  RefreshCw, 
  Network, 
  CheckCircle, 
  XCircle, 
  Info, 
  Router,
  Settings,
  Loader2,
  Save,
  Check,
  Trash2,
  Edit
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface BACnetDevice {
  deviceId: number;
  name: string;
  ipAddress: string;
  vendorName?: string;
  vendorId?: number;
  modelNumber?: string;
  firmwareVersion?: string;
  maxApdu?: number;
  status: 'online' | 'offline';
  lastSeen?: string;
}

interface DiscoveredMeter {
  address: number;
  name: string;
  location?: string;
  manufacturer?: string;
  model?: string;
  parameterCount: number;
  categories: {
    power: number;
    energy: number;
    voltage: number;
    current: number;
    frequency: number;
    powerFactor: number;
    other: number;
  };
  sampleParameters: Array<{
    name: string;
    type: string;
    phase?: string;
    units?: string;
    bacnetObject: string;
  }>;
}

interface BACnetObject {
  type: number;
  instance: number;
  typeName: string;
  name?: string;
  description?: string;
  presentValue?: any;
  units?: string;
}

interface DiscoveryResponse {
  success: boolean;
  count: number;
  devices: BACnetDevice[];
  message?: string;
  error?: string;
}

interface ServiceStatus {
  running: boolean;
  discoveredDevices: number;
  lastScan?: string;
}

export default function BACnetDiscovery() {
  const [devices, setDevices] = useState<BACnetDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [scanningMeters, setScanningMeters] = useState<number | null>(null);
  const [discoveredMeters, setDiscoveredMeters] = useState<Map<number, DiscoveredMeter[]>>(new Map());
  const [viewingObjects, setViewingObjects] = useState<number | null>(null);
  const [allObjects, setAllObjects] = useState<Map<number, BACnetObject[]>>(new Map());
  const [savingMeters, setSavingMeters] = useState<number | null>(null);
  const [savedDevices, setSavedDevices] = useState<Set<number>>(new Set());
  const [selectedMeters, setSelectedMeters] = useState<Map<number, Set<string>>>(new Map());
  const [viewingMeterParams, setViewingMeterParams] = useState<{ deviceId: number; meter: DiscoveredMeter } | null>(null);
  const [existingMeters, setExistingMeters] = useState<Map<number, string[]>>(new Map()); // deviceId -> meter names
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualDeviceData, setManualDeviceData] = useState({ ipAddress: '', deviceId: '', deviceName: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch('/api/bacnet/status');
      const data = await response.json();
      if (data.success) {
        setServiceStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch service status:', error);
    }
  };

  const fetchBACnetDevices = async () => {
    try {
      const response = await fetch('/api/bacnet/devices');
      const data = await response.json();
      if (data.success && data.devices) {
        setDevices(data.devices);
        console.log('[BACnet] Loaded existing devices:', data.devices);
      }
    } catch (error) {
      console.error('Failed to fetch BACnet devices:', error);
    }
  };

  const registerDeviceManually = async () => {
    if (!manualDeviceData.ipAddress || !manualDeviceData.deviceId) {
      toast({
        title: "Missing Information",
        description: "IP Address and Device ID are required",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);
    try {
      const response = await fetch('/api/bacnet/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: manualDeviceData.ipAddress,
          deviceId: parseInt(manualDeviceData.deviceId),
          deviceName: manualDeviceData.deviceName || undefined
        })
      });

      const data = await response.json();
      
      if (data.success && data.device) {
        setDevices([...devices, data.device]);
        setShowManualAdd(false);
        setManualDeviceData({ ipAddress: '', deviceId: '', deviceName: '' });
        
        toast({
          title: "Device Registered",
          description: `${data.device.name} (ID: ${data.device.deviceId}) registered successfully`,
        });
      } else {
        toast({
          title: "Registration Failed",
          description: data.message || "Could not register device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to register device:', error);
      toast({
        title: "Error",
        description: "Failed to register BACnet device",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const deleteDevice = async (device: BACnetDevice) => {
    if (!confirm(`Remove device "${device.name}" (ID: ${device.deviceId}) from the list?`)) {
      return;
    }

    try {
      // Delete from backend
      const response = await fetch(`/api/bacnet/devices/${device.deviceId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Remove from local state
        setDevices(devices.filter(d => d.deviceId !== device.deviceId));
        
        // Clean up associated data
        const newDiscoveredMeters = new Map(discoveredMeters);
        newDiscoveredMeters.delete(device.deviceId);
        setDiscoveredMeters(newDiscoveredMeters);
        
        const newAllObjects = new Map(allObjects);
        newAllObjects.delete(device.deviceId);
        setAllObjects(newAllObjects);
        
        const newSavedDevices = new Set(savedDevices);
        newSavedDevices.delete(device.deviceId);
        setSavedDevices(newSavedDevices);
        
        const newSelectedMeters = new Map(selectedMeters);
        newSelectedMeters.delete(device.deviceId);
        setSelectedMeters(newSelectedMeters);

        toast({
          title: "Device Removed",
          description: `${device.name} has been removed from the list`,
        });
      } else {
        toast({
          title: "Delete Failed",
          description: data.message || "Could not delete device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to delete device:', error);
      toast({
        title: "Error",
        description: "Failed to delete BACnet device",
        variant: "destructive",
      });
    }
  };

  const fetchExistingMeters = async () => {
    try {
      const response = await fetch('/api/devices');
      const data = await response.json();
      if (data.success) {
        // Create a comprehensive map of existing meters
        // Key: BACnet Device ID -> array of meter names
        const metersByDevice = new Map<number, string[]>();
        
        console.log('[Duplicate Check] Fetching existing devices...');
        
        for (const device of data.devices) {
          if (device.type?.toLowerCase().includes('meter') || 
              device.type?.toLowerCase().includes('vfd') ||
              device.type?.toLowerCase().includes('plc') ||
              device.type?.toLowerCase().includes('smart meter')) {
            
            console.log('[Duplicate Check] Found device:', {
              id: device.id,
              name: device.name,
              type: device.type,
              location: device.location,
              ipAddress: device.ipAddress
            });
            
            // Try to extract BACnet device ID from location "BACnet Device 17800"
            const locationMatch = device.location?.match(/BACnet Device (\d+)/i);
            const bacnetDeviceId = locationMatch ? parseInt(locationMatch[1]) : null;
            
            if (bacnetDeviceId) {
              if (!metersByDevice.has(bacnetDeviceId)) {
                metersByDevice.set(bacnetDeviceId, []);
              }
              metersByDevice.get(bacnetDeviceId)!.push(device.name);
              console.log(`[Duplicate Check] Registered: Device ${bacnetDeviceId} -> ${device.name}`);
            } else {
              console.warn('[Duplicate Check] Could not extract BACnet ID from location:', device.location);
            }
          }
        }
        
        console.log('[Duplicate Check] Final map:', Object.fromEntries(metersByDevice));
        setExistingMeters(metersByDevice);
      }
    } catch (error) {
      console.error('Failed to fetch existing meters:', error);
    }
  };

  const startBACnetService = async () => {
    try {
      const response = await fetch('/api/bacnet/start', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Service Started",
          description: "BACnet discovery service is now running",
        });
        await fetchServiceStatus();
      } else {
        toast({
          title: "Service Start Failed",
          description: data.message || "Failed to start BACnet service",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start BACnet service",
        variant: "destructive",
      });
    }
  };

  const stopBACnetService = async () => {
    try {
      const response = await fetch('/api/bacnet/stop', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Service Stopped",
          description: "BACnet discovery service has been stopped",
        });
        setServiceStatus(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop BACnet service",
        variant: "destructive",
      });
    }
  };

  const runDiscovery = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/bacnet/discover');
      const data: DiscoveryResponse = await response.json();
      
      if (data.success) {
        setDevices(data.devices);
        setLastScanTime(new Date().toLocaleString());
        
        toast({
          title: "Discovery Complete",
          description: `Found ${data.count} BACnet device(s)`,
        });

        if (data.count === 0) {
          toast({
            title: "No Devices Found",
            description: "Ensure devices are connected and BACnet IP is enabled",
            variant: "default",
          });
        }
      } else {
        toast({
          title: "Discovery Failed",
          description: data.message || "Failed to discover BACnet devices",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to communicate with BACnet service",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
      await fetchServiceStatus();
    }
  };

  const scanModbusCapabilities = async (deviceId: number) => {
    try {
      const response = await fetch(`/api/bacnet/devices/${deviceId}/modbus`);
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Modbus Scan Complete",
          description: `Found ${data.capabilities.length} Modbus capabilities`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to scan Modbus capabilities",
        variant: "destructive",
      });
    }
  };

  const scanForModbusMeters = async (device: BACnetDevice) => {
    setScanningMeters(device.deviceId);
    try {
      const response = await fetch(
        `/api/bacnet/device/${device.deviceId}/modbus-meters?address=${device.ipAddress}`
      );
      const data = await response.json();
      
      if (data.success) {
        // Store discovered meters for this device
        setDiscoveredMeters(prev => {
          const updated = new Map(prev);
          updated.set(device.deviceId, data.meters);
          return updated;
        });

        toast({
          title: "Modbus Meters Discovered",
          description: `Found ${data.meterCount} meter(s) with ${data.meters.reduce((sum: number, m: DiscoveredMeter) => sum + m.parameterCount, 0)} total parameters`,
        });
      } else {
        toast({
          title: "Scan Failed",
          description: data.message || "Failed to scan for Modbus meters",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to scan for Modbus meters via BACnet",
        variant: "destructive",
      });
    } finally {
      setScanningMeters(null);
    }
  };

  const viewAllObjects = async (device: BACnetDevice): Promise<any[]> => {
    setViewingObjects(device.deviceId);
    try {
      const response = await fetch(
        `/api/bacnet/device/${device.deviceId}/objects?address=${device.ipAddress}`
      );
      const data = await response.json();
      
      if (data.success) {
        // Store all objects for this device
        setAllObjects(prev => {
          const updated = new Map(prev);
          updated.set(device.deviceId, data.objects);
          return updated;
        });

        toast({
          title: "Objects Retrieved",
          description: `Found ${data.objects.length} BACnet object(s)`,
        });
        
        return data.objects; // Return the objects for immediate use
      } else {
        toast({
          title: "Scan Failed",
          description: data.message || "Failed to read BACnet objects",
          variant: "destructive",
        });
        return [];
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to read BACnet objects",
        variant: "destructive",
      });
      return [];
    } finally {
      setViewingObjects(null);
    }
  };

  const saveMetersToDevices = async (device: BACnetDevice) => {
    const meters = discoveredMeters.get(device.deviceId);
    if (!meters || meters.length === 0) {
      toast({
        title: "No Meters Found",
        description: "Please scan for objects first before saving",
        variant: "destructive",
      });
      return;
    }

    // Check if any meters are selected
    const selected = selectedMeters.get(device.deviceId);
    if (!selected || selected.size === 0) {
      toast({
        title: "No Meters Selected",
        description: "Please select at least one meter to save",
        variant: "destructive",
      });
      return;
    }

    setSavingMeters(device.deviceId);
    try {
      // Get all objects for parameter details
      const objects = allObjects.get(device.deviceId) || [];
      
      // Filter only selected meters
      const selectedMetersList = meters.filter(meter => 
        selected.has(meter.name)
      );
      
      // Helper to get category from parameter type
      const getCategoryFromType = (paramType: string): string => {
        if (paramType.includes('voltage')) return 'voltage';
        if (paramType.includes('current')) return 'current';
        if (paramType.includes('power') || paramType.includes('active_power')) return 'power';
        if (paramType.includes('energy')) return 'energy';
        if (paramType.includes('frequency')) return 'frequency';
        return 'electrical';
      };
      
      // Check for duplicates
      const existingMeterNames = existingMeters.get(device.deviceId) || [];
      console.log('Checking duplicates for device', device.deviceId);
      console.log('Existing meters:', existingMeterNames);
      console.log('Selected meters:', selectedMetersList.map(m => m.name));
      
      const duplicates = selectedMetersList.filter(meter => 
        existingMeterNames.includes(meter.name)
      );
      
      console.log('Found duplicates:', duplicates.map(d => d.name));
      
      if (duplicates.length > 0) {
        const duplicateNames = duplicates.map(m => m.name).join(', ');
        const confirmSave = window.confirm(
          `⚠️ Warning: ${duplicates.length} meter(s) already exist:\n\n${duplicateNames}\n\nSaving will create duplicates. Continue anyway?`
        );
        if (!confirmSave) {
          setSavingMeters(null);
          return;
        }
      }
      
      // Auto-load all objects if not already loaded
      let deviceObjects = allObjects.get(device.deviceId) || [];
      if (deviceObjects.length === 0) {
        console.log('[Save Meters] Auto-loading all BACnet objects...');
        deviceObjects = await viewAllObjects(device);
      }
      
      // Prepare meters data for saving
      const metersToSave = selectedMetersList.map(meter => {
        // Get ALL parameters for this meter from deviceObjects
        const meterPrefix = meter.name.replace(/\s+/g, '_');
        const meterPrefixNoUnderscore = meter.name.replace(/\s+/g, '');
        
        // Filter all objects that belong to this meter
        const meterObjects = deviceObjects.filter(obj => {
          if (!obj.name) return false;
          const objName = obj.name;
          return objName.startsWith(meterPrefix) || 
                 objName.startsWith(meterPrefixNoUnderscore) ||
                 objName.startsWith(meter.name) ||
                 objName.includes(meter.name);
        });
        
        // Use all meter objects if found, otherwise fall back to sample parameters
        const allParameters = meterObjects.length > 0 ? meterObjects : 
          meter.sampleParameters.map(param => {
            const fullObject = objects.find(obj => 
              `Type${obj.type}:${obj.instance}` === param.bacnetObject
            );
            return fullObject;
          }).filter(Boolean);
        
        console.log(`[Save Meters] ${meter.name}: Saving ${allParameters.length} parameters`);
        
        return {
          name: meter.name,
          meterGroupKey: `${device.deviceId}_${meter.name.replace(/\s+/g, '_')}`,
          location: device.name || `BACnet Device ${device.deviceId}`,
          deviceType: meter.name.includes('VFD') ? 'VFD' : 'Smart Meter',
          parameters: allParameters.map(obj => {
            // Extract parameter info from BACnet object
            const paramName = obj.name || 'Unnamed';
            const paramType = paramName.toLowerCase().includes('voltage') ? 'voltage' :
                            paramName.toLowerCase().includes('current') ? 'current' :
                            paramName.toLowerCase().includes('power') && !paramName.toLowerCase().includes('factor') ? 'active_power' :
                            paramName.toLowerCase().includes('energy') ? 'energy' :
                            paramName.toLowerCase().includes('frequency') ? 'frequency' : 'other';
            const phase = paramName.match(/L(\d)/)?.[1] ? `L${paramName.match(/L(\d)/)?.[1]}` : undefined;
            
            return {
              objectType: obj.type,
              objectInstance: obj.instance,
              objectName: paramName,
              parameterType: paramType,
              phase: phase,
              units: obj.units,
              category: getCategoryFromType(paramType),
              description: obj.description,
            };
          }),
        };
      });

      const response = await fetch(
        `/api/bacnet/device/${device.deviceId}/save-meters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ meters: metersToSave }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSavedDevices(prev => new Set(prev).add(device.deviceId));
        
        // Refresh existing meters list
        await fetchExistingMeters();
        
        toast({
          title: "Meters Saved Successfully",
          description: `Saved ${data.savedCount} meter(s) to device list`,
        });

        // Navigate to devices page after 2 seconds
        setTimeout(() => {
          setLocation('/devices');
        }, 2000);
      } else {
        toast({
          title: "Save Failed",
          description: data.message || "Failed to save meters",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save meters to device list",
        variant: "destructive",
      });
    } finally {
      setSavingMeters(null);
    }
  };

  const getCategoryFromType = (type: string): string => {
    if (type?.includes('power')) return 'power';
    if (type?.includes('energy')) return 'energy';
    if (type?.includes('voltage')) return 'voltage';
    if (type?.includes('current')) return 'current';
    if (type?.includes('frequency')) return 'frequency';
    if (type?.includes('factor')) return 'powerFactor';
    return 'other';
  };

  const toggleMeterSelection = (deviceId: number, meterName: string) => {
    setSelectedMeters(prev => {
      const updated = new Map(prev);
      const deviceSelection = updated.get(deviceId) || new Set<string>();
      
      if (deviceSelection.has(meterName)) {
        deviceSelection.delete(meterName);
      } else {
        deviceSelection.add(meterName);
      }
      
      updated.set(deviceId, deviceSelection);
      return updated;
    });
  };

  const toggleAllMeters = (deviceId: number, selectAll: boolean) => {
    const meters = discoveredMeters.get(deviceId);
    if (!meters) return;

    setSelectedMeters(prev => {
      const updated = new Map(prev);
      if (selectAll) {
        updated.set(deviceId, new Set(meters.map(m => m.name)));
      } else {
        updated.set(deviceId, new Set());
      }
      return updated;
    });
  };

  const getVendorBadgeColor = (vendorName?: string) => {
    switch (vendorName?.toLowerCase()) {
      case 'loytec': return 'bg-blue-100 text-blue-800';
      case 'honeywell': return 'bg-orange-100 text-orange-800';
      case 'johnson controls': return 'bg-green-100 text-green-800';
      case 'schneider electric': return 'bg-purple-100 text-purple-800';
      case 'siemens': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    fetchServiceStatus();
    fetchBACnetDevices();
    fetchExistingMeters();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BACnet Device Discovery</h1>
          <p className="text-muted-foreground">
            Discover and manage BACnet IP controllers on your network
          </p>
        </div>
        <div className="flex gap-2">
          {serviceStatus?.running ? (
            <Button variant="outline" onClick={stopBACnetService}>
              <XCircle className="h-4 w-4 mr-2" />
              Stop Service
            </Button>
          ) : (
            <Button variant="outline" onClick={startBACnetService}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Start Service
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => setShowManualAdd(true)}
            disabled={!serviceStatus?.running}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manual Add
          </Button>
          <Button 
            onClick={runDiscovery} 
            disabled={isScanning || !serviceStatus?.running}
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isScanning ? "Scanning..." : "Discover Devices"}
          </Button>
        </div>
      </div>

      {/* Service Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Service Status
          </CardTitle>
          <CardDescription>
            BACnet discovery service monitoring and control
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${serviceStatus?.running ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {serviceStatus?.running ? 'Service Running' : 'Service Stopped'}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Discovered Devices: </span>
              {serviceStatus?.discoveredDevices || 0}
            </div>
            <div className="text-sm">
              <span className="font-medium">Last Scan: </span>
              {lastScanTime || 'Never'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Alert */}
      {devices.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Getting Started</AlertTitle>
          <AlertDescription>
            To discover BACnet IP controllers (Loytec, Honeywell, Johnson Controls, Schneider, etc.):
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Connect your BACnet controller to the same network</li>
              <li>Ensure BACnet IP service is enabled on the device</li>
              <li>Click "Start Service" to initialize the BACnet discovery service</li>
              <li>Click "Discover Devices" to scan the network</li>
              <li>Your controllers should appear in the list below</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* Discovered Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Router className="h-5 w-5" />
            Discovered Devices ({devices.length})
          </CardTitle>
          <CardDescription>
            BACnet IP controllers found on your network
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No BACnet devices discovered yet.</p>
              <p className="text-sm">Click "Discover Devices" to scan your network.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device Name</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.deviceId}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell>{device.ipAddress}</TableCell>
                    <TableCell>{device.deviceId}</TableCell>
                    <TableCell>
                      {device.vendorName ? (
                        <Badge className={getVendorBadgeColor(device.vendorName)}>
                          {device.vendorName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>{device.modelNumber || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={device.status === 'online' ? 'default' : 'destructive'}
                      >
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => scanForModbusMeters(device)}
                          disabled={scanningMeters === device.deviceId}
                        >
                          {scanningMeters === device.deviceId ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Scanning...
                            </>
                          ) : (
                            <>
                              <Settings className="h-4 w-4 mr-1" />
                              Scan Objects
                            </>
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => viewAllObjects(device)}
                          disabled={viewingObjects === device.deviceId}
                        >
                          {viewingObjects === device.deviceId ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <Info className="h-4 w-4 mr-1" />
                              View All Objects
                            </>
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => deleteDevice(device)}
                          title="Remove device"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {discoveredMeters.get(device.deviceId) && discoveredMeters.get(device.deviceId)!.length > 0 && (
                          savedDevices.has(device.deviceId) ? (
                            <Badge variant="default" className="bg-green-500">
                              <Check className="h-3 w-3 mr-1" />
                              Saved
                            </Badge>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => saveMetersToDevices(device)}
                              disabled={savingMeters === device.deviceId || !selectedMeters.get(device.deviceId)?.size}
                            >
                              {savingMeters === device.deviceId ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-1" />
                                  Save Selected ({selectedMeters.get(device.deviceId)?.size || 0})
                                </>
                              )}
                            </Button>
                          )
                        )}
                        {discoveredMeters.get(device.deviceId) && (
                          <Badge variant="secondary">
                            {discoveredMeters.get(device.deviceId)?.length} meters
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Discovered Modbus Meters */}
      {Array.from(discoveredMeters.entries()).map(([deviceId, meters]) => {
        const device = devices.find(d => d.deviceId === deviceId);
        if (!device) return null;

        return (
          <Card key={`meters-${deviceId}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Router className="h-5 w-5" />
                Modbus Meters from {device.name} ({meters.length})
              </CardTitle>
              <CardDescription>
                Energy meters discovered via BACnet objects (AI, AV, MSV)
              </CardDescription>
              <div className="flex gap-2 mt-4">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => toggleAllMeters(deviceId, true)}
                >
                  Select All
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => toggleAllMeters(deviceId, false)}
                >
                  Deselect All
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">
                  {selectedMeters.get(deviceId)?.size || 0} of {meters.length} selected
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {meters.map((meter, idx) => {
                  const isSelected = selectedMeters.get(deviceId)?.has(meter.name) || false;
                  const alreadySaved = existingMeters.get(deviceId)?.includes(meter.name) || false;
                  
                  // Debug logging
                  if (idx === 0) {
                    console.log(`Device ${deviceId} - Existing meters:`, existingMeters.get(deviceId));
                    console.log(`Checking meter "${meter.name}" - Already saved:`, alreadySaved);
                  }
                  
                  return (
                  <Card key={idx} className={`border-l-4 ${
                    alreadySaved ? 'border-l-orange-500 bg-orange-50/50' :
                    isSelected ? 'border-l-green-500 bg-green-50/50' : 
                    'border-l-blue-500'
                  }`}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (alreadySaved) {
                              toast({
                                title: "⚠️ Meter Already Exists",
                                description: `${meter.name} is already saved. Saving again will create a duplicate.`,
                                variant: "destructive",
                              });
                            }
                            toggleMeterSelection(deviceId, meter.name);
                          }}
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {meter.name}
                            {alreadySaved && (
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                                ✓ Already Saved
                              </Badge>
                            )}
                            {meter.address > 0 && (
                              <Badge variant="outline" className="ml-2">
                                Address {meter.address}
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {meter.location && `Location: ${meter.location} • `}
                            {meter.manufacturer && `${meter.manufacturer} `}
                            {meter.model && `${meter.model}`}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {meter.categories.power > 0 && (
                            <Badge variant="secondary">⚡ {meter.categories.power} Power</Badge>
                          )}
                          {meter.categories.energy > 0 && (
                            <Badge variant="secondary">🔋 {meter.categories.energy} Energy</Badge>
                          )}
                          {meter.categories.voltage > 0 && (
                            <Badge variant="secondary">📊 {meter.categories.voltage} Voltage</Badge>
                          )}
                          {meter.categories.current > 0 && (
                            <Badge variant="secondary">⚙️ {meter.categories.current} Current</Badge>
                          )}
                          {meter.categories.frequency > 0 && (
                            <Badge variant="secondary">📡 {meter.categories.frequency} Frequency</Badge>
                          )}
                          {meter.categories.powerFactor > 0 && (
                            <Badge variant="secondary">📈 {meter.categories.powerFactor} PF</Badge>
                          )}
                        </div>

                        <div className="text-sm">
                          <div className="font-medium mb-2">Sample Parameters:</div>
                          <div className="space-y-1">
                            {meter.sampleParameters.map((param, pidx) => (
                              <div key={pidx} className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className="font-mono">
                                  {param.bacnetObject}
                                </Badge>
                                <span>{param.name}</span>
                                {param.units && (
                                  <span className="text-muted-foreground">({param.units})</span>
                                )}
                              </div>
                            ))}
                            {meter.parameterCount > 5 && (
                              <div className="text-muted-foreground text-xs">
                                + {meter.parameterCount - 5} more parameters
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => {
                              // Toggle checkbox selection
                              const currentSelected = selectedMeters.get(device.deviceId) || new Set();
                              const newSelected = new Set(currentSelected);
                              if (newSelected.has(meter.name)) {
                                newSelected.delete(meter.name);
                              } else {
                                newSelected.add(meter.name);
                              }
                              const newMap = new Map(selectedMeters);
                              newMap.set(device.deviceId, newSelected);
                              setSelectedMeters(newMap);
                              toast({
                                title: newSelected.has(meter.name) ? "Meter Selected" : "Meter Deselected",
                                description: `${meter.name} ${newSelected.has(meter.name) ? 'will be saved' : 'removed from selection'}`,
                              });
                            }}
                          >
                            {selectedMeters.get(device.deviceId)?.has(meter.name) ? (
                              <><Check className="h-4 w-4 mr-2" /> Selected</>
                            ) : (
                              "Configure for Dashboard"
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={async () => {
                              // Ensure all objects are loaded first
                              if (!allObjects.has(device.deviceId)) {
                                await viewAllObjects(device);
                              }
                              setViewingMeterParams({ deviceId: device.deviceId, meter });
                            }}
                          >
                            View All Parameters
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* All BACnet Objects (Raw View) */}
      {Array.from(allObjects.entries()).map(([deviceId, objects]) => {
        const device = devices.find(d => d.deviceId === deviceId);
        if (!device) return null;

        return (
          <Card key={`objects-${deviceId}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                All BACnet Objects from {device.name} ({objects.length})
              </CardTitle>
              <CardDescription>
                Raw BACnet objects with current values (regardless of naming)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Instance</TableHead>
                    <TableHead>Object ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Present Value</TableHead>
                    <TableHead>Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objects.map((obj, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {obj.typeName}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{obj.instance}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {obj.type}:{obj.instance}
                      </TableCell>
                      <TableCell>
                        {obj.name ? (
                          <span className="font-medium">{obj.name}</span>
                        ) : (
                          <span className="text-muted-foreground italic">No name</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {obj.description || (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {obj.presentValue !== undefined && obj.presentValue !== null ? (
                          <span className="font-mono">{String(obj.presentValue)}</span>
                        ) : (
                          <span className="text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {obj.units || (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Parameter Viewing Dialog */}
      <Dialog open={!!viewingMeterParams} onOpenChange={(open) => !open && setViewingMeterParams(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingMeterParams?.meter.name} - All Parameters ({viewingMeterParams?.meter.parameterCount})
            </DialogTitle>
            <DialogDescription>
              Complete parameter list from BACnet device
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              if (!viewingMeterParams) return null;
              
              // Get all objects for this device
              const deviceObjects = allObjects.get(viewingMeterParams.deviceId) || [];
              
              console.log('All device objects:', deviceObjects.length);
              console.log('Meter name:', viewingMeterParams.meter.name);
              
              // Filter objects that belong to this meter
              // Try multiple matching strategies
              const meterName = viewingMeterParams.meter.name;
              const meterPrefix = meterName.replace(/\s+/g, '_');
              const meterPrefixNoUnderscore = meterName.replace(/\s+/g, '');
              
              const meterObjects = deviceObjects.filter(obj => {
                if (!obj.name) return false;
                const objName = obj.name;
                // Match if object name starts with meter name (with or without underscores)
                return objName.startsWith(meterPrefix) || 
                       objName.startsWith(meterPrefixNoUnderscore) ||
                       objName.startsWith(meterName) ||
                       objName.includes(meterName);
              });
              
              console.log('Filtered meter objects:', meterObjects.length);
              
              // If no filtered objects, fall back to sample parameters
              const parametersToShow = meterObjects.length > 0 
                ? meterObjects.map(obj => ({
                    name: obj.name || 'Unnamed',
                    bacnetObject: `Type${obj.type}:${obj.instance}`,
                    type: obj.typeName,
                    units: obj.units,
                    phase: obj.name?.match(/L(\d)/)?.[1] ? `L${obj.name.match(/L(\d)/)?.[1]}` : undefined,
                  }))
                : viewingMeterParams.meter.sampleParameters;
              
              console.log('Parameters to show:', parametersToShow.length);
              
              return parametersToShow.map((param, idx) => {
                const getIcon = () => {
                  const name = param.name?.toLowerCase() || '';
                  if (name.includes('voltage')) return { icon: '⚡', color: 'border-yellow-500', iconColor: 'text-yellow-500' };
                  if (name.includes('current')) return { icon: '🔌', color: 'border-purple-500', iconColor: 'text-purple-500' };
                  if (name.includes('power') && !name.includes('factor')) return { icon: '💡', color: 'border-blue-500', iconColor: 'text-blue-500' };
                  if (name.includes('energy') || name.includes('kwh')) return { icon: '🔋', color: 'border-green-500', iconColor: 'text-green-500' };
                  if (name.includes('frequency') || name.includes('freq')) return { icon: '〰️', color: 'border-orange-500', iconColor: 'text-orange-500' };
                  if (name.includes('torque')) return { icon: '🔧', color: 'border-red-500', iconColor: 'text-red-500' };
                  if (name.includes('speed') || name.includes('rpm')) return { icon: '💨', color: 'border-cyan-500', iconColor: 'text-cyan-500' };
                  if (name.includes('motor')) return { icon: '⚙️', color: 'border-indigo-500', iconColor: 'text-indigo-500' };
                  return { icon: '📈', color: 'border-gray-400', iconColor: 'text-gray-500' };
                };
                const { icon, color, iconColor } = getIcon();
                return (
                  <Card key={idx} className={`border-l-4 ${color}`}>
                    <CardHeader className="pb-2 px-3 pt-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xl ${iconColor}`}>{icon}</span>
                        <CardTitle className="text-sm font-medium text-muted-foreground line-clamp-2 flex-1">
                          {param.name}
                        </CardTitle>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {param.bacnetObject}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <Badge variant="secondary" className="ml-2">{param.type}</Badge>
                        </div>
                        {param.phase && (
                          <div>
                            <span className="text-muted-foreground">Phase:</span>
                            <Badge variant="secondary" className="ml-2">{param.phase}</Badge>
                          </div>
                        )}
                        {param.units && (
                          <div>
                            <span className="text-muted-foreground">Units:</span>
                            <span className="ml-2 font-mono">{param.units}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Device Registration Dialog */}
      <Dialog open={showManualAdd} onOpenChange={setShowManualAdd}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manually Register BACnet Device</DialogTitle>
            <DialogDescription>
              Add a BACnet device manually if it doesn't respond to discovery broadcasts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ipAddress">
                IP Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ipAddress"
                placeholder="e.g., 192.168.1.33"
                value={manualDeviceData.ipAddress}
                onChange={(e) => setManualDeviceData({ ...manualDeviceData, ipAddress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceId">
                BACnet Device ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deviceId"
                type="number"
                placeholder="e.g., 17800"
                value={manualDeviceData.deviceId}
                onChange={(e) => setManualDeviceData({ ...manualDeviceData, deviceId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceName">
                Device Name <span className="text-muted-foreground text-xs">(Optional)</span>
              </Label>
              <Input
                id="deviceName"
                placeholder="e.g., LIOB-589"
                value={manualDeviceData.deviceName}
                onChange={(e) => setManualDeviceData({ ...manualDeviceData, deviceName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                If not provided, the device name will be read from the BACnet device
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowManualAdd(false);
                setManualDeviceData({ ipAddress: '', deviceId: '', deviceName: '' });
              }}
              disabled={isRegistering}
            >
              Cancel
            </Button>
            <Button 
              onClick={registerDeviceManually}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Device'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}