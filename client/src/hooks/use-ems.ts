import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertDevice, type InsertAlert, type InsertThreshold } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// === DEVICES HOOKS ===

export function useDevices() {
  return useQuery({
    queryKey: [api.devices.list.path],
    queryFn: async () => {
      const res = await fetch(api.devices.list.path);
      if (!res.ok) throw new Error("Failed to fetch devices");
      return api.devices.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Real-time refresh
  });
}

export function useDevice(id: number) {
  return useQuery({
    queryKey: [api.devices.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.devices.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch device");
      return api.devices.get.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDevice) => {
      const validated = api.devices.create.input.parse(data);
      const res = await fetch(api.devices.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to create device");
      return api.devices.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.devices.list.path] });
      toast({ title: "Device Added", description: "New device is now being monitored." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add device.", variant: "destructive" });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.devices.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete device");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.devices.list.path] });
      toast({ title: "Device Removed", description: "Device has been removed from the system." });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertDevice> }) => {
      console.log('useUpdateDevice called with:', { id, data });
      const validated = api.devices.update.input.parse(data);
      console.log('Validated data:', validated);
      const url = buildUrl(api.devices.update.path, { id });
      console.log('Update URL:', url);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      console.log('Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Update failed:', errorText);
        throw new Error("Failed to update device");
      }
      const result = await res.json();
      console.log('Update result:', result);
      return api.devices.update.responses[200].parse(result);
    },
    onSuccess: () => {
      console.log('Update successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: [api.devices.list.path] });
      toast({ title: "Device Updated", description: "Device information has been updated." });
    },
    onError: (error) => {
      console.error('Update error in hook:', error);
      toast({ title: "Error", description: "Failed to update device.", variant: "destructive" });
    },
  });
}

// === READINGS HOOKS ===

export function useLatestReading(deviceId: number) {
  return useQuery({
    queryKey: [api.readings.latest.path, deviceId],
    queryFn: async () => {
      const url = buildUrl(api.readings.latest.path, { id: deviceId });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch reading");
      return api.readings.latest.responses[200].parse(await res.json());
    },
    refetchInterval: 2000, // Fast update for live readings
  });
}

export function useReadingHistory(deviceId: number) {
  return useQuery({
    queryKey: [api.readings.history.path, deviceId],
    queryFn: async () => {
      const url = buildUrl(api.readings.history.path, { id: deviceId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch history");
      return api.readings.history.responses[200].parse(await res.json());
    },
    refetchInterval: 10000,
  });
}

// === ALERTS HOOKS ===

export function useAlerts(status: 'active' | 'acknowledged' | 'all' = 'active') {
  return useQuery({
    queryKey: [api.alerts.list.path, status],
    queryFn: async () => {
      const url = `${api.alerts.list.path}?status=${status}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return api.alerts.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.alerts.acknowledge.path, { id });
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to acknowledge alert");
      return api.alerts.acknowledge.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.alerts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.analytics.overview.path] });
      toast({ title: "Alert Acknowledged", description: "The alert has been marked as handled." });
    },
  });
}

// === ANALYTICS HOOKS ===

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: [api.analytics.overview.path],
    queryFn: async () => {
      const res = await fetch(api.analytics.overview.path);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return api.analytics.overview.responses[200].parse(await res.json());
    },
    refetchInterval: 10000,
  });
}

// === THRESHOLDS HOOKS ===

export function useThresholds() {
  return useQuery({
    queryKey: [api.thresholds.list.path],
    queryFn: async () => {
      const res = await fetch(api.thresholds.list.path);
      if (!res.ok) throw new Error("Failed to fetch thresholds");
      return api.thresholds.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateThreshold() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertThreshold) => {
      const validated = api.thresholds.create.input.parse(data);
      const res = await fetch(api.thresholds.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to create threshold");
      return api.thresholds.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.thresholds.list.path] });
      toast({ title: "Threshold Added", description: "New alarm threshold has been configured." });
    },
  });
}

export function useUpdateThreshold() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertThreshold> }) => {
      const url = buildUrl(api.thresholds.update.path, { id });
      const validated = api.thresholds.update.input.parse(data);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to update threshold");
      return api.thresholds.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.thresholds.list.path] });
      toast({ title: "Threshold Updated", description: "Alarm threshold configuration has been saved." });
    },
  });
}

export function useDeleteThreshold() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.thresholds.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete threshold");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.thresholds.list.path] });
      toast({ title: "Threshold Deleted", description: "Alarm threshold has been removed." });
    },
  });
}
