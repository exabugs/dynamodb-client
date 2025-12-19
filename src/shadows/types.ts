/**
 * Shadow field types supported by the automatic shadow generation system
 */
export type ShadowFieldType = 'string' | 'number' | 'datetime' | 'boolean' | 'array' | 'object';

/**
 * Shadow field configuration
 */
export interface ShadowFieldConfig {
  type: ShadowFieldType;
}

// Legacy shadow configuration types removed in v0.3.x
// Use environment variables for configuration instead

/**
 * Result of shadow difference calculation
 */
export interface ShadowDiff {
  /** List of shadow SKs to delete */
  toDelete: string[];
  /** List of shadow SKs to add */
  toAdd: string[];
}
