import { z } from 'zod';

export const categorySchema = z.enum([
  'food_nutrition',
  'medical_health',
  'elderly_care',
  'shelter_clothing',
  'transport_logistics',
  'emergency_repair'
]);

export const urgencySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const taskStatusSchema = z.enum(['pending', 'blocked', 'ready', 'in_progress', 'completed', 'failed']);
export const availabilitySchema = z.enum(['available', 'busy', 'offline']);

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const requestCreateSchema = z.object({
  title: shortText(200),
  description: shortText(10000),
  category: categorySchema,
  urgency: urgencySchema.default('medium'),
  locationArea: shortText(160),
  recipientName: shortText(160),
  recipientContact: shortText(200),
  resourcesNeeded: z.array(z.object({
    resourceId: shortText(30).optional(),
    resourceName: shortText(160),
    category: categorySchema,
    unit: shortText(40),
    quantityNeeded: z.number().int().positive().max(100000)
  })).min(1).max(20),
  tasks: z.array(z.object({
    title: shortText(200),
    description: shortText(5000),
    requiredSkills: z.array(shortText(100)).max(30).default([]),
    estimatedMinutes: z.number().int().positive().max(10080).default(30),
    dependencyIndexes: z.array(z.number().int().nonnegative()).default([]),
    requiredResourceIndex: z.number().int().nonnegative().optional(),
    requiredResourceQuantity: z.number().int().positive().optional(),
    prerequisites: z.array(z.object({
      type: z.enum(['TASK_PREREQUISITE', 'RESOURCE_STOCK', 'VOLUNTEER_QUALIFICATION', 'RECIPIENT_CONTACT']),
      title: shortText(160),
      details: shortText(2000),
      targetTaskIndex: z.number().int().nonnegative().optional(),
      targetResourceIndex: z.number().int().nonnegative().optional()
    })).default([])
  })).max(100).default([])
}).strict();

export const volunteerCreateSchema = z.object({
  name: shortText(160),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(64).optional(),
  avatar: z.string().url().max(2000).optional(),
  skills: z.array(shortText(100)).max(50).default([]),
  serviceAreas: z.array(shortText(120)).max(50).default([]),
  timeSlots: z.array(shortText(80)).max(30).default([]),
  availabilityStatus: availabilitySchema.default('available'),
  hoursPerWeek: z.number().int().min(0).max(168).default(0),
}).strict();

export const volunteerUpdateSchema = z.object({
  skills: z.array(shortText(100)).max(50).optional(),
  serviceAreas: z.array(shortText(120)).max(50).optional(),
  timeSlots: z.array(shortText(80)).max(30).optional(),
  availabilityStatus: availabilitySchema.optional(),
  hoursPerWeek: z.number().int().min(0).max(168).optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const resourceCreateSchema = z.object({
  name: shortText(160),
  category: categorySchema,
  unit: shortText(40),
  totalAvailable: z.number().int().min(0).max(1000000).default(0),
  notes: z.string().trim().max(2000).optional()
}).strict();

export const resourceUpdateSchema = z.object({
  name: shortText(160).optional(),
  category: categorySchema.optional(),
  unit: shortText(40).optional(),
  notes: z.string().trim().max(2000).optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const quantitySchema = z.object({ quantity: z.number().int().positive().max(100000) }).strict();

export const taskCreateSchema = z.object({
  title: shortText(200),
  description: shortText(5000),
  requiredSkills: z.array(shortText(100)).max(30).default([]),
  estimatedMinutes: z.number().int().positive().max(10080).default(30),
  dependencyIds: z.array(shortText(30)).max(100).default([]),
  requiredResourceId: shortText(30).optional(),
  requiredResourceQuantity: z.number().int().positive().optional()
}).strict();

export const taskStatusUpdateSchema = z.object({
  status: z.enum(['in_progress', 'completed']),
  notes: z.string().trim().max(5000).optional()
}).strict();

export const confirmationSchema = z.object({
  confirmed: z.boolean(),
  feedback: z.string().trim().max(5000).optional(),
  disputed: z.boolean().default(false),
  disputeReason: z.string().trim().max(5000).optional()
}).strict().refine((value) => value.confirmed !== value.disputed, 'Choose either confirmation or dispute, not both.');
