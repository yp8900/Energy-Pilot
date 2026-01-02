import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Radio, 
  RefreshCw, 
  Zap, 
  Activity, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';

interface ModbusDevice {
  address: number;
  deviceType: string;
  manufacturer: string;
  model: string;
  registers: Array<{
    name: string;
    address: number;
    unit: string;
    description: string;
  }>;
  status: 'online' | 'offline';
  lastSeen: string;
}

export default function ModbusScanner() {
  const [connectionType, setConnectionType] = useState<'tcp' | 'serial'>('tcp');
  
  // TCP Settings
  const [tcpHost, setTcpHost] = useState('192.168.1.47');
  const [tcpPort, setTcpPort] = useState('502');
  
  // Serial Settings
  const [serialPort, setSerialPort] = useState('COM1');
  const [baudRate, setBaudRate] = useState('9600');
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [dataBits, setDataBits] = useState<'7' | '8'>('8');
  const [stopBits, setStopBits] = useState<'1' | '2'>('1');
  
  // Scan Settings
  const [startAddress, setStartAddress] = useState('1');
  const [endAddress, setEndAddress] = useState('20');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);

  const queryClient = useQueryClient();

  // Fetch discovered devices
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['/api/modbus/devices'],
    refetchInterval: isConnected ? 5000 : false,
  });

  // Fetch device readings
  const { data: readingsData, isLoading: readingsLoading } = useQuery({
    queryKey: [`/api/modbus/device/${selectedDevice}/read`],
    enabled: selectedDevice !== null && isConnected,
    refetchInterval: 2000, // Read every 2 seconds
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const options = connectionType === 'tcp' 
        ? { 
            host: tcpHost, 
            port: parseInt(tcpPort) 
          }
        : { 
            port: serialPort,
            baudRate: parseInt(baudRate),
            parity: parity,
            dataBits: parseInt(dataBits),
            stopBits: parseInt(stopBits)
          };

      const response = await fetch('/api/modbus/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionType, options }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection failed');
      }

      return response.json();
    },
    onSuccess: () => {
      setIsConnected(true);
      queryClient.invalidateQueries({ queryKey: ['/api/modbus/devices'] });
    },
  });

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/modbus/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAddress: parseInt(startAddress),
          endAddress: parseInt(endAddress),
          timeout: 500,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Scan failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modbus/devices'] });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/modbus/disconnect', {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      setIsConnected(false);
      setSelectedDevice(null);
      queryClient.invalidateQueries({ queryKey: ['/api/modbus/devices'] });
    },
  });

  const devices: ModbusDevice[] = devicesData?.devices || [];
  const deviceCount = devices.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modbus RTU Scanner</h1>
          <p className="text-muted-foreground">
            Scan RS485 bus for Modbus devices and energy meters
          </p>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"} className="text-sm">
          {isConnected ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Connected
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 mr-1" />
              Disconnected
            </>
          )}
        </Badge>
      </div>

      {/* Configuration Guide */}
      {!isConnected && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Modbus Configuration Guide</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p><strong>For TCP/IP Gateway (Loytec LIOB-589):</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
              <li>Use gateway IP address (e.g., 192.168.1.47)</li>
              <li>Port 502 (standard Modbus TCP)</li>
              <li>Gateway handles RS485 ↔ TCP conversion</li>
            </ul>
            
            <p className="mt-3"><strong>For Direct Serial (RS485 USB Adapter):</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
              <li><strong>Port:</strong> COM1, COM3 (Windows) or /dev/ttyUSB0 (Linux)</li>
              <li><strong>Baud Rate:</strong> Check your meter manual (9600 or 19200 most common)</li>
              <li><strong>Parity:</strong> None (N) or Even (E) - must match meter config</li>
              <li><strong>Data Bits:</strong> 8 bits (standard)</li>
              <li><strong>Stop Bits:</strong> 1 bit (standard)</li>
            </ul>

            <p className="mt-3"><strong>Common Meter Configurations:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
              <li><strong>Schneider PM8000:</strong> 9600-N-8-1 or 19200-E-8-1</li>
              <li><strong>ABB M2M:</strong> 9600-E-8-1</li>
              <li><strong>Siemens PAC:</strong> 9600-N-8-1 or 19200-N-8-1</li>
              <li><strong>Generic meters:</strong> Try 9600-N-8-1 first</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Connect to Modbus via TCP gateway (Loytec LIOB-589) or direct serial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Connection Type */}
            <div className="space-y-2">
              <Label>Connection Type</Label>
              <div className="flex gap-4">
                <Button
                  variant={connectionType === 'tcp' ? 'default' : 'outline'}
                  onClick={() => setConnectionType('tcp')}
                  disabled={isConnected}
                  className="flex-1"
                >
                  <Radio className="w-4 h-4 mr-2" />
                  TCP/IP Gateway
                </Button>
                <Button
                  variant={connectionType === 'serial' ? 'default' : 'outline'}
                  onClick={() => setConnectionType('serial')}
                  disabled={isConnected}
                  className="flex-1"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Direct Serial
                </Button>
              </div>
            </div>

            {/* TCP Settings */}
            {connectionType === 'tcp' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tcp-host">Gateway IP Address</Label>
                  <Input
                    id="tcp-host"
                    value={tcpHost}
                    onChange={(e) => setTcpHost(e.target.value)}
                    placeholder="192.168.1.47"
                    disabled={isConnected}
                  />
                  <p className="text-xs text-muted-foreground">
                    IP address of Loytec LIOB-589 or Modbus gateway
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tcp-port">Modbus TCP Port</Label>
                  <Input
                    id="tcp-port"
                    type="number"
                    value={tcpPort}
                    onChange={(e) => setTcpPort(e.target.value)}
                    placeholder="502"
                    disabled={isConnected}
                  />
                  <p className="text-xs text-muted-foreground">
                    Standard Modbus TCP port is 502
                  </p>
                </div>
              </>
            )}

            {/* Serial Settings */}
            {connectionType === 'serial' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="serial-port">Serial Port (COM Port)</Label>
                  <Input
                    id="serial-port"
                    value={serialPort}
                    onChange={(e) => setSerialPort(e.target.value)}
                    placeholder="COM1, COM3, /dev/ttyUSB0"
                    disabled={isConnected}
                  />
                  <p className="text-xs text-muted-foreground">
                    Windows: COM1, COM3, etc. | Linux: /dev/ttyUSB0
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baud-rate">Baud Rate</Label>
                  <select
                    id="baud-rate"
                    value={baudRate}
                    onChange={(e) => setBaudRate(e.target.value)}
                    disabled={isConnected}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="1200">1200 bps</option>
                    <option value="2400">2400 bps</option>
                    <option value="4800">4800 bps</option>
                    <option value="9600">9600 bps (Common)</option>
                    <option value="19200">19200 bps</option>
                    <option value="38400">38400 bps</option>
                    <option value="57600">57600 bps</option>
                    <option value="115200">115200 bps</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Most energy meters use 9600 or 19200 bps
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parity">Parity</Label>
                  <select
                    id="parity"
                    value={parity}
                    onChange={(e) => setParity(e.target.value as 'none' | 'even' | 'odd')}
                    disabled={isConnected}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="none">None (N)</option>
                    <option value="even">Even (E)</option>
                    <option value="odd">Odd (O)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Common: None or Even
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data-bits">Data Bits</Label>
                  <select
                    id="data-bits"
                    value={dataBits}
                    onChange={(e) => setDataBits(e.target.value as '7' | '8')}
                    disabled={isConnected}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="7">7 bits</option>
                    <option value="8">8 bits (Standard)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Standard is 8 data bits
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stop-bits">Stop Bits</Label>
                  <select
                    id="stop-bits"
                    value={stopBits}
                    onChange={(e) => setStopBits(e.target.value as '1' | '2')}
                    disabled={isConnected}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="1">1 stop bit (Standard)</option>
                    <option value="2">2 stop bits</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Standard is 1 stop bit
                  </p>
                </div>

                {/* Common Presets */}
                <div className="col-span-2 space-y-2">
                  <Label>Common Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBaudRate('9600');
                        setParity('none');
                        setDataBits('8');
                        setStopBits('1');
                      }}
                      disabled={isConnected}
                    >
                      9600-N-8-1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBaudRate('9600');
                        setParity('even');
                        setDataBits('8');
                        setStopBits('1');
                      }}
                      disabled={isConnected}
                    >
                      9600-E-8-1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBaudRate('19200');
                        setParity('none');
                        setDataBits('8');
                        setStopBits('1');
                      }}
                      disabled={isConnected}
                    >
                      19200-N-8-1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBaudRate('19200');
                        setParity('even');
                        setDataBits('8');
                        setStopBits('1');
                      }}
                      disabled={isConnected}
                    >
                      19200-E-8-1
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click a preset to quickly configure common settings
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Connection Summary */}
          {!isConnected && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Settings</AlertTitle>
              <AlertDescription>
                {connectionType === 'tcp' ? (
                  <>Connecting to Modbus TCP gateway at <strong>{tcpHost}:{tcpPort}</strong></>
                ) : (
                  <>
                    Connecting to serial port <strong>{serialPort}</strong> with{' '}
                    <strong>{baudRate}-{parity.charAt(0).toUpperCase()}-{dataBits}-{stopBits}</strong>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {!isConnected ? (
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="w-full"
              >
                {connectMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Connect to Modbus
              </Button>
            ) : (
              <Button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                variant="destructive"
                className="w-full"
              >
                Disconnect
              </Button>
            )}
          </div>

          {connectMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>
                {(connectMutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Bus Scan */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Modbus Bus</CardTitle>
            <CardDescription>
              Search for devices on the RS485 bus (addresses 1-247)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-addr">Start Address</Label>
                <Input
                  id="start-addr"
                  type="number"
                  min="1"
                  max="247"
                  value={startAddress}
                  onChange={(e) => setStartAddress(e.target.value)}
                  disabled={scanMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-addr">End Address</Label>
                <Input
                  id="end-addr"
                  type="number"
                  min="1"
                  max="247"
                  value={endAddress}
                  onChange={(e) => setEndAddress(e.target.value)}
                  disabled={scanMutation.isPending}
                />
              </div>
            </div>

            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="w-full"
            >
              {scanMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning... This may take a minute
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Scan Bus
                </>
              )}
            </Button>

            {scanMutation.isSuccess && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Scan Complete</AlertTitle>
                <AlertDescription>
                  Found {scanMutation.data.count} device(s) on the bus
                </AlertDescription>
              </Alert>
            )}

            {scanMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Scan Error</AlertTitle>
                <AlertDescription>
                  {(scanMutation.error as Error).message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Discovered Devices */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Discovered Devices ({deviceCount})</CardTitle>
            <CardDescription>
              Modbus devices found on the RS485 bus
            </CardDescription>
          </CardHeader>
          <CardContent>
            {devicesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                No devices found. Click "Scan Bus" to search for devices.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Registers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow 
                      key={device.address}
                      className={selectedDevice === device.address ? 'bg-muted' : ''}
                    >
                      <TableCell className="font-mono">{device.address}</TableCell>
                      <TableCell>{device.deviceType}</TableCell>
                      <TableCell>{device.manufacturer}</TableCell>
                      <TableCell>{device.registers.length} registers</TableCell>
                      <TableCell>
                        <Badge
                          variant={device.status === 'online' ? 'default' : 'destructive'}
                        >
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDevice(device.address)}
                        >
                          <Activity className="w-4 h-4 mr-1" />
                          Read Data
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Device Readings */}
      {selectedDevice !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Device {selectedDevice} - Live Readings</CardTitle>
            <CardDescription>
              Real-time energy meter data (updates every 2 seconds)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {readingsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : readingsData?.values ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(readingsData.values).map(([key, data]: [string, any]) => (
                  <Card key={key}>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {key.replace(/_/g, ' ').toUpperCase()}
                        </p>
                        <p className="text-2xl font-bold">
                          {data.value.toFixed(2)} {data.unit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(data.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
