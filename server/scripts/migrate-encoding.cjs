/**
 * 一次性迁移脚本：修复文件名乱码、重命名磁盘文件、追加 markdown 附件部分
 *
 * 使用方法（必须在服务器停止状态下运行）：
 *   node server/scripts/migrate-encoding.js
 *
 * 幂等设计：可安全重复执行。
 */
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================

const DB_PATH = path.join(__dirname, '..', 'data', 'memoflow.db.json');
const VAULT_PATH = path.join(__dirname, '..', '..', 'vault');
const MEMORIES_DIR = path.join(VAULT_PATH, 'memories');

// ==================== 编码工具 ====================

function isMojibake(s) {
  if (!s || !/[\u0080-\u00ff]/.test(s)) return false;
  try {
    const decoded = Buffer.from(s, 'latin1').toString('utf8');
    return decoded !== s && /[\u4e00-\u9fa5]/.test(decoded);
  } catch {
    return false;
  }
}

function decodeFileName(filename) {
  if (!isMojibake(filename)) return filename;
  try {
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch {
    return filename;
  }
}

// ==================== 附件区块生成 ====================

function buildAttachmentsSection(files) {
  if (!files || files.length === 0) return '';
  const lines = files.map((f) => {
    const diskName = path.basename(f.path);
    return f.mimetype.startsWith('image/') ? `![[${diskName}]]` : `[[${diskName}]]`;
  });
  return `\n## 附件\n\n${lines.join('\n')}\n`;
}

// ==================== 迁移主逻辑 ====================

function migrate() {
  console.log('=== MemoFlow 编码迁移开始 ===\n');

  // 1. 读取数据库
  if (!fs.existsSync(DB_PATH)) {
    console.error('数据库文件不存在:', DB_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const db = JSON.parse(raw);
  let changedCount = 0;
  let renamedCount = 0;
  let markdownUpdatedCount = 0;

  // 2. 遍历所有带文件的记忆记录
  const memoriesWithFiles = db.memories.filter((m) => m.files_json);
  console.log(`找到 ${memoriesWithFiles.length} 条带文件的记忆记录\n`);

  for (const mem of memoriesWithFiles) {
    let files;
    try {
      files = JSON.parse(mem.files_json);
    } catch {
      console.warn(`[跳过] ${mem.id}: files_json 解析失败`);
      continue;
    }

    if (!Array.isArray(files)) {
      console.warn(`[跳过] ${mem.id}: files_json 不是数组`);
      continue;
    }

    let filesChanged = false;

    for (const f of files) {
      const oldName = f.name;
      const oldPath = f.path;

      // 解码文件名
      const newName = decodeFileName(oldName);

      if (newName !== oldName) {
        console.log(`[${mem.id}] 文件名解码:`);
        console.log(`  旧: ${oldName}`);
        console.log(`  新: ${newName}`);

        // 从旧路径提取时间戳前缀和目录
        const oldBasename = path.basename(oldPath);
        const dir = path.dirname(oldPath);
        const underscoreIdx = oldBasename.indexOf('_');
        const timestamp = underscoreIdx > 0 ? oldBasename.slice(0, underscoreIdx) : '';

        // 构建新路径
        const newBasename = timestamp ? `${timestamp}_${newName}` : newName;
        const newPath = path.join(dir, newBasename);

        // 如果磁盘文件存在，重命名
        if (fs.existsSync(oldPath) && path.resolve(oldPath) !== path.resolve(newPath)) {
          try {
            fs.renameSync(oldPath, newPath);
            console.log(`  磁盘文件已重命名: ${oldBasename} -> ${newBasename}`);
            renamedCount++;
          } catch (err) {
            console.error(`  磁盘重命名失败: ${err.message}`);
            // 磁盘重命名失败，仍然更新数据库（path 指向新路径）
          }
        } else if (!fs.existsSync(oldPath)) {
          console.log(`  磁盘文件不存在（size=${f.size}），仅更新数据库`);
        }

        f.name = newName;
        f.path = newPath;
        filesChanged = true;
      }
    }

    // 更新 files_json
    if (filesChanged) {
      mem.files_json = JSON.stringify(files);
      changedCount++;
      console.log('');
    }

    // 为 markdown 追加 ## 附件 部分（幂等）
    const mdPath = mem.file_path;
    if (mdPath && fs.existsSync(mdPath)) {
      let mdContent = fs.readFileSync(mdPath, 'utf-8');

      // 检查是否已有 ## 附件 部分
      if (!mdContent.includes('## 附件')) {
        const attachmentsSection = buildAttachmentsSection(files);
        if (attachmentsSection) {
          mdContent = mdContent.trimEnd() + '\n' + attachmentsSection;
          fs.writeFileSync(mdPath, mdContent, 'utf-8');
          console.log(`[${mem.id}] Markdown 已追加附件部分: ${path.basename(mdPath)}`);
          markdownUpdatedCount++;
        }
      }
    }
  }

  // 3. 保存数据库
  db.memories = db.memories; // 确保引用不变
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  console.log('\n=== 迁移完成 ===');
  console.log(`数据库记录更新: ${changedCount} 条`);
  console.log(`磁盘文件重命名: ${renamedCount} 个`);
  console.log(`Markdown 追加附件: ${markdownUpdatedCount} 个`);
}

try {
  migrate();
} catch (err) {
  console.error('迁移失败:', err);
  process.exit(1);
}
