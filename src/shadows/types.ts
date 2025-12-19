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

/**
 * Resource-specific shadow configuration
 */
export interface ResourceShadowConfig {
  sortDefaults: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  shadows: {
    [fieldName: string]: ShadowFieldConfig;
  };
  ttl?: {
    days: number;
  };
}

/**
 * Complete shadow configuration structure (shadow.config.json)
 */
export interface ShadowConfig {
  $schemaVersion: string;
  resources: {
    [resourceName: string]: ResourceShadowConfig;
  };
}

/**
 * Result of shadow difference calculation
 */
export interface ShadowDiff {
  /** List of shadow SKs to delete */
  toDelete: string[];
  /** List of shadow SKs to add */
  toAdd: string[];
}
