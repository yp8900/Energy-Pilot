import { z } from 'zod';
import { insertDeviceSchema, insertAlertSchema, insertThresholdSchema, devices, readings, alerts, users, thresholds } from './schema';

// === SHARED ERROR SCHEMAS ===
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// === API CONTRACT ===
export const api = {
  // --- DEVICES ---
  devices: {
    list: {
      method: 'GET' as const,
      path: '/api/devices',
      responses: {
        200: z.array(z.custom<typeof devices.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/devices/:id',
      responses: {
        200: z.custom<typeof devices.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/devices',
      input: insertDeviceSchema,
      responses: {
        201: z.custom<typeof devices.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/devices/:id',
      input: insertDeviceSchema.partial(),
      responses: {
        200: z.custom<typeof devices.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/devices/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // --- READINGS ---
  readings: {
    latest: {
      method: 'GET' as const,
      path: '/api/devices/:id/readings/latest',
      responses: {
        200: z.custom<typeof readings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    history: {
      method: 'GET' as const,
      path: '/api/devices/:id/readings',
      input: z.object({
        limit: z.coerce.number().optional().default(100),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof readings.$inferSelect>()),
      },
    },
    // For simulation/ingestion
    create: {
      method: 'POST' as const,
      path: '/api/readings',
      input: z.object({
        deviceId: z.number(),
        power: z.number(),
        voltage: z.number(),
        current: z.number(),
        energy: z.number(),
        frequency: z.number(),
        powerFactor: z.number(),
      }),
      responses: {
        201: z.custom<typeof readings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // --- ALERTS ---
  alerts: {
    list: {
      method: 'GET' as const,
      path: '/api/alerts',
      input: z.object({
        status: z.enum(['active', 'acknowledged', 'all']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof alerts.$inferSelect & { deviceName: string }>()),
      },
    },
    acknowledge: {
      method: 'POST' as const,
      path: '/api/alerts/:id/acknowledge',
      responses: {
        200: z.custom<typeof alerts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // --- ANALYTICS ---
  analytics: {
    overview: {
      method: 'GET' as const,
      path: '/api/analytics/overview',
      responses: {
        200: z.object({
          totalConsumption: z.number(),
          activeAlarms: z.number(),
          onlineDevices: z.number(),
          totalDevices: z.number(),
        }),
      },
    },
    consumption: {
      method: 'GET' as const,
      path: '/api/analytics/consumption',
      responses: {
        200: z.array(z.object({
          date: z.string(),
          deviceId: z.number(),
          deviceName: z.string(),
          energy: z.number(),
          power: z.number(),
          cost: z.number(),
        })),
      },
    },
    export: {
      method: 'POST' as const,
      path: '/api/analytics/export',
      input: z.object({
        timeRange: z.enum(['daily', 'weekly', 'monthly', 'custom']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        format: z.enum(['csv', 'excel']).default('csv'),
      }),
      responses: {
        200: z.object({
          data: z.string(),
          filename: z.string(),
        }),
      },
    },
  },

  // --- THRESHOLDS ---
  thresholds: {
    list: {
      method: 'GET' as const,
      path: '/api/thresholds',
      responses: {
        200: z.array(z.custom<typeof thresholds.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/thresholds',
      input: z.custom<typeof insertThresholdSchema>(),
      responses: {
        201: z.custom<typeof thresholds.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/thresholds/:id',
      input: z.custom<Partial<typeof insertThresholdSchema>>(),
      responses: {
        200: z.custom<typeof thresholds.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/thresholds/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      },
    },
  },
};

// === HELPER ===
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
