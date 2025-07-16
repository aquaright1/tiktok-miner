import { z } from 'zod'

// Common query parameter schemas
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  page: z.coerce.number().min(1).optional()
}).transform(data => ({
  ...data,
  // Convert page to offset if provided
  offset: data.page ? (data.page - 1) * data.limit : data.offset
}))

export const sortingSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
})

export const searchSchema = z.object({
  search: z.string().trim().optional(),
  searchFields: z.array(z.string()).optional()
})

// Helper to parse query parameters with a schema
export function parseQueryParams<T extends z.ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params: Record<string, any> = {}
  
  searchParams.forEach((value, key) => {
    // Handle array parameters (e.g., ?tags=a&tags=b)
    if (params[key]) {
      if (Array.isArray(params[key])) {
        params[key].push(value)
      } else {
        params[key] = [params[key], value]
      }
    } else {
      params[key] = value
    }
  })
  
  return schema.parse(params)
}

// Helper to build query string from object
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    
    if (Array.isArray(value)) {
      value.forEach(v => searchParams.append(key, String(v)))
    } else {
      searchParams.append(key, String(value))
    }
  })
  
  return searchParams.toString()
}