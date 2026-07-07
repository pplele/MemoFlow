import { initDb } from './index.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

function setupVault() {
  const dirs = [
    config.vault.path,
    path.join(config.vault.path, 'memories'),
    path.join(config.vault.path, 'facts'),
    path.join(config.vault.path, 'assets'),
    path.join(config.vault.path, 'assets', 'images'),
    path.join(config.vault.path, 'templates'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[Vault] Created: ${dir}`);
    }
  }

  const templatePath = path.join(config.vault.path, 'templates', 'memory-template.md');
  if (!fs.existsSync(templatePath)) {
    const template = `---
id: "{{id}}"
created_at: "{{created_at}}"
updated_at: "{{updated_at}}"
source: "web"
type: "text"
category: ""
tags: []
entities: []
relations: []
facts: []
---

# {{title}}

{{content}}

## AI 解析摘要

**分类**: {{category}}
**标签**: {{tags}}

## 关联

{{links}}
`;
    fs.writeFileSync(templatePath, template, 'utf-8');
    console.log('[Vault] Created memory template');
  }
}

async function main() {
  console.log('[Setup] Initializing MemoFlow...');

  await initDb();
  console.log('[Setup] Database initialized');

  setupVault();
  console.log('[Setup] Vault directories created');

  console.log('[Setup] Done! Run "npm run dev" to start.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Setup] Failed:', err);
  process.exit(1);
});
