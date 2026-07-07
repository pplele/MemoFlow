const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'memoflow.db.json');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'vault', 'uploads');

function decodeFileName(filename) {
  try {
    const decoded = Buffer.from(filename, 'latin1').toString('utf8');
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded;
    }
    return filename;
  } catch {
    return filename;
  }
}

function fixFilenames() {
  console.log('=== 修复文件名开始 ===\n');

  if (!fs.existsSync(DB_PATH)) {
    console.log('数据库文件不存在');
    return;
  }

  const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const memories = dbData.memories || [];

  console.log(`数据库中有 ${memories.length} 条记忆`);

  const fileMap = new Map();

  for (const m of memories) {
    if (!m.files_json) continue;
    
    try {
      const files = JSON.parse(m.files_json);
      if (Array.isArray(files)) {
        for (const f of files) {
          if (f.path) {
            const filename = path.basename(f.path);
            const decodedName = decodeFileName(filename);
            fileMap.set(filename, {
              originalName: f.name,
              decodedName: decodedName,
              memoryId: m.id,
            });
          }
        }
      }
    } catch (e) {
      console.log(`解析 files_json 失败: ${m.id}`);
    }
  }

  console.log(`数据库中记录了 ${fileMap.size} 个文件`);

  const uploadFiles = fs.readdirSync(UPLOADS_DIR);
  let fixedCount = 0;

  for (const file of uploadFiles) {
    const filePath = path.join(UPLOADS_DIR, file);
    if (!fs.statSync(filePath).isFile()) continue;

    const info = fileMap.get(file);
    if (info) {
      const hasUnderscores = file.includes('________________');
      
      if (hasUnderscores && info.originalName) {
        const timestamp = file.split('_')[0];
        const ext = path.extname(file);
        const newName = `${timestamp}_${info.originalName}`;
        const newPath = path.join(UPLOADS_DIR, newName);

        if (file !== newName) {
          fs.renameSync(filePath, newPath);
          console.log(`重命名: ${file}`);
          console.log(`       → ${newName}`);
          fixedCount++;
        }
      }
    }
  }

  console.log(`\n=== 修复完成 ===`);
  console.log(`修复了 ${fixedCount} 个文件名`);
}

try {
  fixFilenames();
} catch (err) {
  console.error('修复失败:', err);
}
