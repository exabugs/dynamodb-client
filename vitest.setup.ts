import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Multi-stage dotenv loading for Vitest
 * Priority order (highest to lowest):
 * 1. infra/.env.test
 * 2. infra/.env.local
 * 3. infra/.env
 * 4. .env.local
 * 5. .env
 */

const envFiles = [
  resolve(process.cwd(), 'infra', '.env.test'),
  resolve(process.cwd(), 'infra', '.env.local'),
  resolve(process.cwd(), 'infra', '.env'),
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
];

// Load env files in reverse order so higher priority files override lower ones
for (const envFile of envFiles.reverse()) {
  if (existsSync(envFile)) {
    config({ path: envFile, override: false });
  }
}
