import { useState } from "react";
import * as React from "react";
import { Search, Server, MoreHorizontal, RefreshCw, Edit, Trash2, CheckCircle } from "lucide-react";
import { useDevices, useDeleteDevice, useUpdateDevice } from "@/hooks/use-ems";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDeviceSchema, type InsertDevice, type Device } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Custom validation schema for form
const deviceFormSchema = z.object({
  name: z.string().min(1, "Device name is required").min(3, "Name must be at least 3 characters"),
  type: z.string().min(1, "Device type is required"),
  location: z.string().optional(),
  ipAddress: z.string().optional(),
  status: z.string().default("offline"),
  isBillingMeter: z.boolean().default(false)
});

type DeviceFormData = z.infer<typeof deviceFormSchema>;

function EditDeviceDialog({ device, open, setOpen }: { 
  device: Device | null; 
  open: boolean; 
  setOpen: (open: boolean) => void; 
}) {
  const { mutateAsync: updateDevice, isPending } = useUpdateDevice();
  const { toast } = useToast();
  
  const form = useForm<DeviceFormData>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      name: "",
      type: "",
      location: "",
      ipAddress: "",
      status: "offline",
    },
  });

  // Update form when device changes
  React.useEffect(() => {
    if (device) {
      console.log('Setting form values for device:', device);
      const formData = {
        name: device.name || "",
        type: device.type || "",
        location: device.location || "",
        ipAddress: device.ipAddress || "",
        status: device.status || "offline",
        isBillingMeter: device.isBillingMeter || false,
      };
      console.log('Form data to set:', formData);
      form.reset(formData);
    }
  }, [device, form]);

  const onSubmit = async (data: DeviceFormData) => {
    if (!device) return;
    
    try {
      console.log('Form data before submit:', data);
      console.log('Device ID:', device.id);
      
      // Validate form first
      const isValid = await form.trigger();
      if (!isValid) {
        console.log('Form validation failed');
        return;
      }
      
      await updateDevice({ id: device.id, data: data as InsertDevice });
      setOpen(false);
      toast({
        title: "Success",
        description: "Device updated successfully",
      });
    } catch (error) {
      console.error('Failed to update device:', error);
      toast({
        title: "Error", 
        description: "Failed to update device. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (!device) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle>Edit Device</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Main PLC 01, Smart Meter Building A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select device type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="plc">PLC</SelectItem>
                        <SelectItem value="smart_meter">Smart Meter</SelectItem>
                        <SelectItem value="sensor">Sensor</SelectItem>
                        <SelectItem value="gateway">Gateway</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Building A - Floor 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ipAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP Address</FormLabel>
                  <FormControl>
                    <Input placeholder="192.168.1.100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isBillingMeter"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-blue-50 dark:bg-blue-950/30">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-semibold">
                      Main Billing Meter
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Mark as main utility meter for cost calculation. Sub-meters should NOT be checked to avoid double-counting energy consumption.
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isPending}
              onClick={() => console.log('UPDATE BUTTON CLICKED!')}
            >
              {isPending ? "Updating..." : "Update Device"}
            </Button>
            {/* Debug button to test form submission */}
            <Button 
              type="button" 
              variant="outline" 
              className="w-full mt-2" 
              onClick={() => {
                console.log('Debug button clicked');
                console.log('Form values:', form.getValues());
                form.handleSubmit(onSubmit)();
              }}
            >
              Debug Update
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Devices() {
  const { data: devices, isLoading, refetch } = useDevices();
  const { mutateAsync: deleteDevice } = useDeleteDevice();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const handleDeleteDevice = async (deviceId: number) => {
    if (window.confirm("Are you sure you want to delete this device?")) {
      try {
        await deleteDevice(deviceId);
        toast({
          title: "Success",
          description: "Device deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete device",
          variant: "destructive"
        });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDevices.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select devices to delete",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedDevices.size} selected device(s)?`)) {
      return;
    }

    try {
      setDeleting(true);
      const deletePromises = Array.from(selectedDevices).map(id => deleteDevice(id));
      await Promise.all(deletePromises);
      
      toast({
        title: "Success",
        description: `Deleted ${selectedDevices.size} device(s) successfully`,
      });
      
      setSelectedDevices(new Set());
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete some devices",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleDeviceSelection = (deviceId: number) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const selectAllDevices = () => {
    if (filteredDevices) {
      setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
    }
  };

  const clearSelection = () => {
    setSelectedDevices(new Set());
  };

  const handleEditDevice = (device: Device) => {
    setEditDevice(device);
    setEditDialogOpen(true);
  };

  const filteredDevices = devices?.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.location && d.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-muted-foreground">Manage connected PLCs, meters, and sensors.</p>
        </div>
      </div>

      <div className="flex items-center space-x-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk Actions */}
      {filteredDevices && filteredDevices.length > 0 && (
        <div className="flex items-center gap-2 bg-card p-3 rounded-lg border border-border/50">
          <Button onClick={selectAllDevices} variant="outline" size="sm">
            <CheckCircle className="h-4 w-4 mr-2" />
            Select All ({filteredDevices.length})
          </Button>
          <Button onClick={clearSelection} variant="outline" size="sm">
            Clear Selection
          </Button>
          <Button 
            onClick={handleBulkDelete} 
            variant="destructive" 
            size="sm"
            disabled={selectedDevices.size === 0 || deleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedDevices.size})
          </Button>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-4 w-12">
                  <Checkbox
                    checked={filteredDevices && filteredDevices.length > 0 && selectedDevices.size === filteredDevices.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllDevices();
                      } else {
                        clearSelection();
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-4">Device Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    Loading devices...
                  </td>
                </tr>
              ) : !filteredDevices || filteredDevices?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Server className="h-12 w-12 mb-3 text-muted-foreground/30" />
                      <p className="text-lg font-medium">No devices found</p>
                      <p className="text-sm mt-1">
                        {searchTerm 
                          ? "No devices matching your search."
                          : "Add devices from BACnet Discovery or Modbus Energy Discovery pages."
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDevices?.map((device) => (
                  <tr key={device.id} className="group hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-4">
                      <Checkbox
                        checked={selectedDevices.has(device.id)}
                        onCheckedChange={() => toggleDeviceSelection(device.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                          <Server className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-2">
                          {device.name}
                          {device.isBillingMeter && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded border border-green-300 dark:border-green-700">
                              💰 BILLING
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{device.type}</td>
                    <td className="px-6 py-4 text-muted-foreground">{device.location || "-"}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{device.ipAddress || "-"}</td>
                    <td className="px-6 py-4">
                      <StatusIndicator status={device.status || "offline"} pulse={false} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditDevice(device)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Device
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteDevice(device.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Device
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Edit Device Dialog */}
      <EditDeviceDialog 
        device={editDevice}
        open={editDialogOpen}
        setOpen={setEditDialogOpen}
      />
    </div>
  );
}
