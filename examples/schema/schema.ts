import { SchemaRegistryConfig, ShadowFieldType } from '@exabugs/dynamodb-client/shadows';

/**
 * Article type definition
 */
export interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  author: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Schema Registry Configuration
 *
 * This configuration defines the database structure and shadow records
 * for efficient sorting and querying in DynamoDB Single-Table design.
 */
export const MySchemaRegistry: SchemaRegistryConfig = {
  database: {
    name: 'myapp',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  resources: {
    articles: {
      resource: 'articles',
      type: {} as Article,
      shadows: {
        sortableFields: {
          title: { type: ShadowFieldType.String },
          status: { type: ShadowFieldType.String },
          author: { type: ShadowFieldType.String },
          createdAt: { type: ShadowFieldType.Datetime },
          updatedAt: { type: ShadowFieldType.Datetime },
        },
      },
    },
  },
};
