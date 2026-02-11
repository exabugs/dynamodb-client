import { defineConfig } from 'orval';

export default defineConfig({
  'dynamodb-client': {
    input: {
      target: './docs/specs/openapi.bundled.yaml',
    },
    output: {
      mode: 'tags-split',
      target: './src/__generated__/index.ts',
      schemas: './src/__generated__/models',
      mock: false,
      client: 'fetch',
    },
  },
});
