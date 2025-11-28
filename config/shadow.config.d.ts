/**
 * Shadow設定の型定義
 */
export interface ShadowConfig {
  $schemaVersion: string;
  resources: {
    [resourceName: string]: {
      sortDefaults?: {
        field: string;
        order: 'ASC' | 'DESC';
      };
      shadows?: {
        [fieldName: string]: {
          type: 'string' | 'number' | 'datetime';
        };
      };
    };
  };
}

declare const config: ShadowConfig;
export default config;
