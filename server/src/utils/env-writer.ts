import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let envWriteLock = false;

export async function updateEnvFile(key: string, value: string): Promise<void> {
  while (envWriteLock) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  envWriteLock = true;
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(__dirname, '../../../');
    const envPath = path.join(projectRoot, '.env');
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(envPath, envContent, 'utf-8');
  } finally {
    envWriteLock = false;
  }
}