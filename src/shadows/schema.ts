/**
 * Shadow Field Type Definition
 *
 * Supported field types for automatic shadow generation.
 * Since v0.3.0, shadow records are automatically generated for all fields
 * based on their runtime type, without requiring configuration files.
 */

/**
 * Shadow field types supported by the automatic shadow generation system
 */
export type ShadowFieldType = 'string' | 'number' | 'datetime' | 'boolean' | 'array' | 'object';
