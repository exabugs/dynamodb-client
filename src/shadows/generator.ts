import { NUMBER_FORMAT } from '../shared/constants/formatting.js';
import type { ShadowFieldType } from './types.js';

/**
 * Escape string values for shadow SK generation
 * Rules: # → ##, space → #
 *
 * @param value - String to escape
 * @returns Escaped string
 */
export function escapeString(value: string): string {
  return value
    .replace(/#/g, '##') // Replace # with ##
    .replace(/ /g, '#'); // Replace space with #
}

/**
 * Convert number to 20-digit zero-padded string
 *
 * @param value - Number to convert (null/undefined allowed)
 * @returns 20-digit zero-padded string
 */
export function formatNumber(value: number | null | undefined): string {
  // Return empty string for null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number value: ${value}`);
  }

  // Treat negative numbers as 0
  const normalized = Math.max(0, Math.floor(value));

  return normalized.toString().padStart(NUMBER_FORMAT.SHADOW_SK_DIGITS, NUMBER_FORMAT.ZERO_PAD_CHAR);
}

/**
 * Format datetime to UTC ISO 8601 format
 *
 * @param value - Datetime string or Date object (null/undefined allowed)
 * @returns UTC ISO 8601 format string
 */
export function formatDatetime(value: string | Date | null | undefined): string {
  // Return empty string for null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }

  return date.toISOString();
}

/**
 * Format boolean value
 *
 * @param value - Boolean value (null/undefined allowed)
 * @returns 'true' or 'false' or empty string
 */
export function formatBoolean(value: boolean | null | undefined): string {
  // Return empty string for null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  return value ? 'true' : 'false';
}

/**
 * Format array to JSON string
 *
 * @param value - Array (null/undefined allowed)
 * @returns JSON string or empty string
 */
export function formatArray(value: any[] | null | undefined): string {
  // Return empty string for null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid array value: ${value}`);
  }

  return JSON.stringify(value);
}

/**
 * Format object to JSON string
 *
 * @param value - Object (null/undefined allowed)
 * @returns JSON string or empty string
 */
export function formatObject(value: object | null | undefined): string {
  // Return empty string for null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid object value: ${value}`);
  }

  return JSON.stringify(value);
}

/**
 * Format field value according to its type
 *
 * @param type - Field type
 * @param value - Value to format (null/undefined allowed)
 * @returns Formatted string
 */
export function formatFieldValue(
  type: ShadowFieldType,
  value: any
): string {
  switch (type) {
    case 'string':
      // For string type, treat null/undefined as empty string
      if (value === null || value === undefined) {
        return '';
      }
      return escapeString(String(value));
    case 'number':
      return formatNumber(value as number | null | undefined);
    case 'datetime':
      return formatDatetime(value as string | Date | null | undefined);
    case 'boolean':
      return formatBoolean(value as boolean | null | undefined);
    case 'array':
      return formatArray(value as any[] | null | undefined);
    case 'object':
      return formatObject(value as object | null | undefined);
    default:
      throw new Error(`Unknown shadow field type: ${type}`);
  }
}

/**
 * Generate shadow SK
 * Format: {fieldName}#{formattedValue}#id#{recordId}
 *
 * @param fieldName - Field name
 * @param value - Field value
 * @param recordId - Record ID (ULID)
 * @param type - Field type (default: 'string')
 * @returns Generated shadow SK
 *
 * @example
 * generateShadowSK('name', 'Tech News', '01HZXY123', 'string')
 * // => 'name#Tech#News#id#01HZXY123'
 *
 * @example
 * generateShadowSK('priority', 123, '01HZXY123', 'number')
 * // => 'priority#00000000000000000123#id#01HZXY123'
 *
 * @example
 * generateShadowSK('createdAt', '2025-11-12T10:00:00.000Z', '01HZXY123', 'datetime')
 * // => 'createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123'
 *
 * @example
 * generateShadowSK('isPublished', true, '01HZXY123', 'boolean')
 * // => 'isPublished#true#id#01HZXY123'
 *
 * @example
 * generateShadowSK('tags', ['tech', 'aws'], '01HZXY123', 'array')
 * // => 'tags#["tech","aws"]#id#01HZXY123'
 *
 * @example
 * generateShadowSK('metadata', { category: 'tech' }, '01HZXY123', 'object')
 * // => 'metadata#{"category":"tech"}#id#01HZXY123'
 */
export function generateShadowSK(
  fieldName: string,
  value: any,
  recordId: string,
  type: ShadowFieldType = 'string'
): string {
  const formattedValue = formatFieldValue(type, value);
  return `${fieldName}#${formattedValue}#id#${recordId}`;
}

/**
 * Generate main record SK from record ID
 * Format: id#{recordId}
 *
 * @param recordId - Record ID (ULID)
 * @returns Main record SK
 */
export function generateMainRecordSK(recordId: string): string {
  return `id#${recordId}`;
}
