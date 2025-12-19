/**
 * @exabugs/dynamodb-client/shadows - Shadow management library
 *
 * Provides dynamic shadow record management for DynamoDB Single-Table design.
 *
 * Main features:
 * - Shadow SK generation (supports string/number/datetime/boolean/array/object)
 * - Shadow difference calculation (comparing old and new shadows)
 * - Configuration management utilities (for legacy compatibility)
 */

// Type definitions export
export type { 
  ShadowFieldType, 
  ShadowFieldConfig, 
  ShadowDiff 
} from './types.js';

// Legacy types (for backward compatibility)
export type { 
  ResourceShadowConfig, 
  ShadowConfig 
} from './types.js';

// Generator functions export
export {
  escapeString,
  formatNumber,
  formatDatetime,
  formatBoolean,
  formatArray,
  formatObject,
  formatFieldValue,
  generateShadowSK,
  generateMainRecordSK,
} from './generator.js';

// Difference calculation functions export
export { calculateShadowDiff, isDiffEmpty, mergeShadowDiffs } from './differ.js';

// Note: Configuration management functions removed in v0.3.x
// Use environment variables for configuration instead
