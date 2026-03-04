import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  RefreshCw, 
  Zap, 
  Info, 
  Settings,
  Loader2,
  Database,
  CheckCircle,
  Save,
  Filter,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiscoveredMeterParameter {
  logId: string;
  itemIndex: string;
  name: string;
  unit: string;
  path: string;
}

interface DiscoveredMeter {
  name: string;
  fullPath: string;
  parameterCount: number;
  parameters: DiscoveredMeterParameter[];
}

export default function ModbusEnergyDiscovery() {
  const [meters, setMeters] = useState<DiscoveredMeter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMeter, setExpandedMeter] = useState<string | null>(null);
  const [selectedMeters, setSelectedMeters] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDiscoveredMeters();
  }, []);

  async function loadDiscoveredMeters() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/discovered-energy-meters.json');
      
      if (!response.ok) {
        throw new Error('Discovery file not found. Please run meter discovery first.');
      }
      
      const data: DiscoveredMeter[] = await response.json();
      setMeters(data);
      
      toast({
        title: "Meters Loaded",
        description: `Found ${data.length} energy meters`,
      });
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function getParameterTypeBadge(paramName: string) {
    const normalizedName = paramName.toUpperCase();
    
    if (normalizedName.includes('WH') || normalizedName.includes('ENERGY')) {
      return <Badge variant="default" className="bg-green-600">Energy</Badge>;
    }
    if (normalizedName.includes('_W') || normalizedName.includes('POWER') || paramName === 'W') {
      return <Badge variant="default" className="bg-blue-600">Power</Badge>;
    }
    if (normalizedName.includes('AMP') || normalizedName.includes('CURRENT')) {
      return <Badge variant="default" className="bg-yellow-600">Current</Badge>;
    }
    if (normalizedName.includes('VLL') || normalizedName.includes('VLN') || normalizedName.includes('VOLTAGE')) {
      return <Badge variant="default" className="bg-purple-600">Voltage</Badge>;
    }
    if (normalizedName.includes('FREQ')) {
      return <Badge variant="default" className="bg-orange-600">Frequency</Badge>;
    }
    if (normalizedName.includes('PF') || normalizedName.includes('POWER_FACTOR')) {
      return <Badge variant="default" className="bg-pink-600">Power Factor</Badge>;
    }
    
    return <Badge variant="secondary">Other</Badge>;
  }

  function getCategoryCounts(meter: DiscoveredMeter) {
    const categories = {
      energy: 0,
      power: 0,
      current: 0,
      voltage: 0,
      frequency: 0,
      powerFactor: 0,
      other: 0
    };

    for (const param of meter.parameters) {
      const name = param.name.toUpperCase();
      
      if (name.includes('WH') || name.includes('ENERGY')) {
        categories.energy++;
      } else if (name.includes('_W') || name.includes('POWER') || param.name === 'W') {
        categories.power++;
      } else if (name.includes('AMP') || name.includes('CURRENT')) {
        categories.current++;
      } else if (name.includes('VLL') || name.includes('VLN') || name.includes('VOLTAGE')) {
        categories.voltage++;
      } else if (name.includes('FREQ')) {
        categories.frequency++;
      } else if (name.includes('PF') || name.includes('POWER_FACTOR')) {
        categories.powerFactor++;
      } else {
        categories.other++;
      }
    }

    return categories;
  }

  function toggleMeterSelection(meterName: string) {
    setSelectedMeters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(meterName)) {
        newSet.delete(meterName);
      } else {
        newSet.add(meterName);
      }
      return newSet;
    });
  }

  function selectAllMeters() {
    setSelectedMeters(new Set(meters.map(m => m.name)));
  }

  function clearSelection() {
    setSelectedMeters(new Set());
  }

  function selectEMMetersOnly() {
    // Select only meters starting with "EM"
    const emMeters = meters.filter(m => m.name.startsWith('EM/')).map(m => m.name);
    setSelectedMeters(new Set(emMeters));
  }

  async function deleteSelectedMeters() {
    if (selectedMeters.size === 0) {
      toast({
        title: "No Meters Selected",
        description: "Please select at least one meter to delete",
        variant: "destructive",
      });
      return;
    }

    try {
      setDeleting(true);
      
      const meterNamesToDelete = Array.from(selectedMeters);
      
      const response = await fetch('/api/modbus/delete-discovered-meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterNames: meterNamesToDelete })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete meters');
      }

      const result = await response.json();
      
      toast({
        title: "Meters Deleted",
        description: `Removed ${result.deletedCount} meters from discovery list`,
      });

      // Refresh the meters list and clear selection
      clearSelection();
      await loadDiscoveredMeters();
      
    } catch (err: any) {
      toast({
        title: "Error Deleting Meters",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function saveSelectedMeters() {
    if (selectedMeters.size === 0) {
      toast({
        title: "No Meters Selected",
        description: "Please select at least one meter to save",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      
      const selectedMeterData = meters.filter(m => selectedMeters.has(m.name));
      
      const response = await fetch('/api/modbus/save-selected-meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meters: selectedMeterData })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save meters');
      }

      const result = await response.json();
      
      toast({
        title: "Meters Saved Successfully",
        description: `Saved ${result.deviceCount} devices with ${result.readingCount} readings`,
      });

      // Clear selection after successful save
      clearSelection();
      
    } catch (err: any) {
      toast({
        title: "Error Saving Meters",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading discovered meters...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Error Loading Meters</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-4">
              <p className="text-sm">To discover energy meters, run:</p>
              <code className="block bg-black/10 px-3 py-2 rounded mt-2">
                npm run discover-meters -- --source ./exported-data
              </code>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            Modbus Energy Meter Discovery
          </h1>
          <p className="text-muted-foreground mt-2">
            Select meters to import into the system
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadDiscoveredMeters} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={saveSelectedMeters} 
            disabled={selectedMeters.size === 0 || saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Selected ({selectedMeters.size})
          </Button>
        </div>
      </div>

      {/* Selection Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={selectAllMeters} variant="outline" size="sm">
              <CheckCircle className="h-4 w-4 mr-2" />
              Select All ({meters.length})
            </Button>
            <Button onClick={selectEMMetersOnly} variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              EM Meters Only
            </Button>
            <Button onClick={clearSelection} variant="outline" size="sm">
              Clear Selection
            </Button>
            <Button 
              onClick={deleteSelectedMeters} 
              variant="destructive" 
              size="sm"
              disabled={selectedMeters.size === 0 || deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Selected ({selectedMeters.size})
            </Button>
            {selectedMeters.size > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {selectedMeters.size} selected
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Meters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{meters.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {meters.reduce((sum, m) => sum + m.parameterCount, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Main Incomer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {meters.find(m => m.name.includes('MAIN')) ? 
                <span className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" /> Found
                </span> : 
                <span className="text-muted-foreground">Not Found</span>
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Modbus RS485
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meters List */}
      <Card>
        <CardHeader>
          <CardTitle>Discovered Energy Meters</CardTitle>
          <CardDescription>
            Click on a meter to view its parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {meters.map((meter, index) => {
              const categories = getCategoryCounts(meter);
              const isExpanded = expandedMeter === meter.name;
              
              return (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedMeters.has(meter.name)}
                        onCheckedChange={() => toggleMeterSelection(meter.name)}
                        className="mt-1"
                      />
                      <div 
                        className="flex-1 cursor-pointer hover:bg-accent/50 transition-colors rounded p-2 -m-2"
                        onClick={() => setExpandedMeter(isExpanded ? null : meter.name)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{meter.name.replace(/\//g, " - ")}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {meter.fullPath}
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline">
                              {meter.parameterCount} parameters
                            </Badge>
                            <div className="flex gap-1 flex-wrap justify-end">
                              {categories.energy > 0 && (
                                <Badge variant="secondary" className="text-xs bg-green-100">
                                  {categories.energy} Energy
                                </Badge>
                              )}
                              {categories.power > 0 && (
                                <Badge variant="secondary" className="text-xs bg-blue-100">
                                  {categories.power} Power
                                </Badge>
                              )}
                              {categories.current > 0 && (
                                <Badge variant="secondary" className="text-xs bg-yellow-100">
                                  {categories.current} Current
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parameter</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Log ID</TableHead>
                            <TableHead>Unit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {meter.parameters.map((param, paramIndex) => (
                            <TableRow key={paramIndex}>
                              <TableCell className="font-medium">
                                {param.name}
                              </TableCell>
                              <TableCell>
                                {getParameterTypeBadge(param.name)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {param.logId}
                              </TableCell>
                              <TableCell>
                                {param.unit || <span className="text-muted-foreground">-</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About This Discovery</AlertTitle>
        <AlertDescription>
          This page shows energy meters discovered from the METRO_BHAWAN BMS database.
          Energy meters are filtered from the Modbus Port RS485/PGM1 path and include
          parameters for energy (WH), power (W), current (Amp), and voltage (V).
        </AlertDescription>
      </Alert>
    </div>
  );
}
