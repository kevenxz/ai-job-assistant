import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '../../..');
export const webDistDir = path.join(repoRoot, 'apps/web/dist');
export const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(repoRoot, '.data');

export const serverConfig = {
  host: '127.0.0.1',
  port: Number(process.env.PORT || 8787),
  version: '0.1.0',
};

export const envLlm = {
  baseUrl: process.env.LLM_BASE_URL || '',
  apiKey: process.env.LLM_API_KEY || '',
  model: process.env.LLM_MODEL || '',
};

export const envChromePath = process.env.CHROME_PATH || '';
