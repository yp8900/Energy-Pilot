import { useState } from "react";
import { Settings, Save, Plus, Trash2, AlertTriangle, Zap, Activity, Edit, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDevices, useThresholds, useCreateThreshold, useUpdateThreshold, useDeleteThreshold } from "@/hooks/use-ems";
import { useToast } from "@/hooks/use-toast";
import { type Threshold } from "@shared/schema";

interface NewThresholdForm {
  deviceId?: number;
  deviceType?: string;
  parameter: string;
  operator: 'greater_than' | 'less_than' | 'equals';
  value: number;
  unit: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  message: string;
}

const defaultThresholds: Threshold[] = [];

const parameterOptions = [
  { value: 'power', label: 'Power (kW)', icon: Zap },
  { value: 'voltage', label: 'Voltage (V)', icon: Activity },
  { value: 'current', label: 'Current (A)', icon: Activity },
  { value: 'frequency', label: 'Frequency (Hz)', icon: Activity },
  { value: 'power_factor', label: 'Power Factor', icon: Activity },
  { value: 'offline_duration', label: 'Offline Duration (min)', icon: AlertTriangle },
];

const severityColors = {
  low: 'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200'
};

export default function AlarmThresholds() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newThreshold, setNewThreshold] = useState<Partial<NewThresholdForm>>({
    parameter: 'power',
    operator: 'greater_than',
    severity: 'medium',
    enabled: true
  });
  
  const { data: devices } = useDevices();
  const { data: thresholds = [], isLoading, error } = useThresholds();
  const createThreshold = useCreateThreshold();
  const updateThreshold = useUpdateThreshold();
  const deleteThreshold = useDeleteThreshold();
  const { toast } = useToast();

  const handleSaveThreshold = (threshold: Threshold) => {
    updateThreshold.mutate({
      id: threshold.id,
      data: {
        deviceId: threshold.deviceId,
        deviceType: threshold.deviceType,
        parameter: threshold.parameter,
        operator: threshold.operator,
        value: threshold.value,
        unit: threshold.unit,
        severity: threshold.severity,
        enabled: threshold.enabled,
        message: threshold.message
      }
    });
    setEditingId(null);
  };

  const handleAddThreshold = () => {
    if (!newThreshold.parameter || !newThreshold.value || !newThreshold.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const thresholdData = {
      parameter: newThreshold.parameter!,
      operator: newThreshold.operator || 'greater_than' as const,
      value: newThreshold.value!,
      unit: getParameterUnit(newThreshold.parameter!),
      severity: newThreshold.severity || 'medium' as const,
      enabled: true,
      message: newThreshold.message!,
      deviceType: newThreshold.deviceType,
      deviceId: newThreshold.deviceId
    };

    createThreshold.mutate(thresholdData);
    
    setNewThreshold({
      parameter: 'power',
      operator: 'greater_than',
      severity: 'medium',
      enabled: true
    });
  };

  const handleDeleteThreshold = (id: number) => {
    deleteThreshold.mutate(id);
  };

  const getParameterUnit = (parameter: string): string => {
    const units: Record<string, string> = {
      power: 'kW',
      voltage: 'V',
      current: 'A',
      frequency: 'Hz',
      power_factor: '',
      offline_duration: 'minutes'
    };
    return units[parameter] || '';
  };

  const getDeviceTypeLabel = (deviceType?: string): string => {
    const labels: Record<string, string> = {
      smart_meter: 'Smart Meters',
      plc: 'PLCs',
      sensor: 'Sensors',
      all: 'All Devices'
    };
    return labels[deviceType || 'all'] || 'Unknown';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alarm Thresholds</h1>
          <p className="text-muted-foreground">Configure threshold values for automated alerts and alarms.</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading thresholds...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-red-600">Failed to load thresholds</div>
        </div>
      )}

      {/* Add New Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Threshold
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="new-parameter">Parameter</Label>
              <Select value={newThreshold.parameter} onValueChange={(value) => 
                setNewThreshold(prev => ({ ...prev, parameter: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select parameter" />
                </SelectTrigger>
                <SelectContent>
                  {parameterOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="new-operator">Condition</Label>
              <Select value={newThreshold.operator} onValueChange={(value: any) => 
                setNewThreshold(prev => ({ ...prev, operator: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="greater_than">Greater than</SelectItem>
                  <SelectItem value="less_than">Less than</SelectItem>
                  <SelectItem value="equals">Equals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="new-value">Threshold Value</Label>
              <Input
                id="new-value"
                type="number"
                step="0.01"
                value={newThreshold.value || ''}
                onChange={(e) => setNewThreshold(prev => ({ ...prev, value: parseFloat(e.target.value) }))}
                placeholder="Enter value"
              />
            </div>

            <div>
              <Label htmlFor="new-severity">Severity</Label>
              <Select value={newThreshold.severity} onValueChange={(value: any) => 
                setNewThreshold(prev => ({ ...prev, severity: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="new-device-type">Device Type</Label>
              <Select value={newThreshold.deviceType || 'all'} onValueChange={(value) => {
                setNewThreshold(prev => ({ 
                  ...prev, 
                  deviceType: value === 'all' ? undefined : value,
                  deviceId: undefined // Reset specific device when type changes
                }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All device types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Device Types</SelectItem>
                  <SelectItem value="smart_meter">Smart Meters</SelectItem>
                  <SelectItem value="plc">PLCs</SelectItem>
                  <SelectItem value="sensor">Sensors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="new-specific-device">Specific Device (Optional)</Label>
              <Select 
                value={newThreshold.deviceId ? String(newThreshold.deviceId) : 'all'} 
                onValueChange={(value) => {
                  setNewThreshold(prev => ({ 
                    ...prev, 
                    deviceId: value === 'all' ? undefined : Number(value) 
                  }));
                }}
                disabled={!newThreshold.deviceType && newThreshold.deviceType !== undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !newThreshold.deviceType && newThreshold.deviceType !== undefined
                      ? "Select device type first"
                      : "Apply to all devices of this type"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices of selected type</SelectItem>
                  {devices
                    ?.filter(device => !newThreshold.deviceType || device.type === newThreshold.deviceType)
                    ?.map(device => (
                      <SelectItem key={device.id} value={String(device.id)}>
                        📍 {device.name} ({device.location || 'No location'})
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {newThreshold.deviceId 
                  ? `Applies only to: ${devices?.find(d => d.id === newThreshold.deviceId)?.name}`
                  : newThreshold.deviceType 
                  ? `Applies to all ${getDeviceTypeLabel(newThreshold.deviceType).toLowerCase()}`
                  : "Applies to all devices in the system"
                }
              </p>
            </div>

            <div>
              <Label htmlFor="new-message">Alert Message</Label>
              <Input
                id="new-message"
                value={newThreshold.message || ''}
                onChange={(e) => setNewThreshold(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter alert message"
              />
            </div>
          </div>

          <Button onClick={handleAddThreshold}>
            <Plus className="h-4 w-4 mr-2" />
            Add Threshold
          </Button>
        </CardContent>
      </Card>

      {/* Existing Thresholds */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Configured Thresholds</h3>
        {thresholds.map(threshold => (
          <Card key={threshold.id} className="relative">
            <CardContent className="p-6">
              {editingId === threshold.id ? (
                <ThresholdEditor
                  threshold={threshold}
                  onSave={handleSaveThreshold}
                  onCancel={() => setEditingId(null)}
                  devices={devices}
                />
              ) : (
                <ThresholdDisplay
                  threshold={threshold}
                  onEdit={() => setEditingId(threshold.id)}
                  onDelete={() => handleDeleteThreshold(threshold.id)}
                  onToggle={(enabled) => {
                    updateThreshold.mutate({
                      id: threshold.id,
                      data: { enabled }
                    });
                  }}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Helper components
function ThresholdDisplay({ 
  threshold, 
  onEdit, 
  onDelete, 
  onToggle 
}: {
  threshold: Threshold;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge 
            variant="outline" 
            className={severityColors[threshold.severity]}
          >
            {threshold.severity.toUpperCase()}
          </Badge>
          <span className="font-medium">
            {threshold.parameter.replace('_', ' ').toUpperCase()} {threshold.operator.replace('_', ' ')} {threshold.value} {threshold.unit}
          </span>
          {!threshold.enabled && <Badge variant="secondary">Disabled</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{threshold.message}</p>
        <p className="text-xs text-muted-foreground">
          Target: {threshold.deviceId 
            ? `Specific device (ID: ${threshold.deviceId})`
            : threshold.deviceType 
            ? getDeviceTypeLabel(threshold.deviceType)
            : "All Devices"
          }
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggle(!threshold.enabled)}
        >
          {threshold.enabled ? 'Disable' : 'Enable'}
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Settings className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ThresholdEditor({ 
  threshold, 
  onSave, 
  onCancel,
  devices
}: {
  threshold: Threshold;
  onSave: (threshold: Threshold) => void;
  onCancel: () => void;
  devices?: any[];
}) {
  const [editData, setEditData] = useState<ThresholdConfig>(threshold);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label>Device Type</Label>
          <Select value={editData.deviceType || 'all'} onValueChange={(value) => {
            setEditData(prev => ({ 
              ...prev, 
              deviceType: value === 'all' ? undefined : value,
              deviceId: undefined // Reset specific device when type changes
            }));
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Device Types</SelectItem>
              <SelectItem value="smart_meter">Smart Meters</SelectItem>
              <SelectItem value="plc">PLCs</SelectItem>
              <SelectItem value="sensor">Sensors</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Specific Device</Label>
          <Select 
            value={editData.deviceId ? String(editData.deviceId) : 'all'} 
            onValueChange={(value) => {
              setEditData(prev => ({ 
                ...prev, 
                deviceId: value === 'all' ? undefined : Number(value) 
              }));
            }}
            disabled={!editData.deviceType && editData.deviceType !== undefined}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !editData.deviceType && editData.deviceType !== undefined
                  ? "Select type first"
                  : "All of type"
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All of selected type</SelectItem>
              {devices
                ?.filter(device => !editData.deviceType || device.type === editData.deviceType)
                ?.map(device => (
                  <SelectItem key={device.id} value={String(device.id)}>
                    📍 {device.name}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Condition</Label>
          <Select value={editData.operator} onValueChange={(value: any) => 
            setEditData(prev => ({ ...prev, operator: value }))
          }>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="greater_than">Greater than</SelectItem>
              <SelectItem value="less_than">Less than</SelectItem>
              <SelectItem value="equals">Equals</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Threshold Value</Label>
          <Input
            type="number"
            step="0.01"
            value={editData.value}
            onChange={(e) => setEditData(prev => ({ ...prev, value: parseFloat(e.target.value) }))}
          />
        </div>

        <div>
          <Label>Severity</Label>
          <Select value={editData.severity} onValueChange={(value: any) => 
            setEditData(prev => ({ ...prev, severity: value }))
          }>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Alert Message</Label>
        <Input
          value={editData.message}
          onChange={(e) => setEditData(prev => ({ ...prev, message: e.target.value }))}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onSave(editData)}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function getDeviceTypeLabel(deviceType?: string): string {
  const labels: Record<string, string> = {
    smart_meter: 'Smart Meters',
    plc: 'PLCs', 
    sensor: 'Sensors',
    all: 'All Devices'
  };
  return labels[deviceType || 'all'] || 'Unknown';
}