const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'memoflow.db.json');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'vault', 'uploads');

function fixFilenames() {
  console.log('=== 根据文件大小匹配修复文件名 ===\n');

  if (!fs.existsSync(DB_PATH)) {
    console.log('数据库文件不存在');
    return;
  }

  const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const memories = dbData.memories || [];

  const dbFileList = [];
  for (const m of memories) {
    if (!m.files_json) continue;
    
    try {
      const files = JSON.parse(m.files_json);
      if (Array.isArray(files)) {
        for (const f of files) {
          if (f.path) {
            const filename = path.basename(f.path);
            dbFileList.push({
              filename,
              originalName: f.name,
              memoryId: m.id,
            });
          }
        }
      }
    } catch (e) {}
  }

  const diskFiles = fs.readdirSync(UPLOADS_DIR)
    .filter(f => fs.statSync(path.join(UPLOADS_DIR, f)).isFile())
    .map(f => ({
      name: f,
      size: fs.statSync(path.join(UPLOADS_DIR, f)).size,
    }));

  console.log('数据库记录的文件:');
  dbFileList.forEach(f => console.log(`  ${f.filename}`));

  console.log('\n磁盘上的文件:');
  diskFiles.forEach(f => console.log(`  ${f.name} (${f.size} bytes)`));

  const sizeMap = new Map();
  diskFiles.forEach(df => {
    if (!sizeMap.has(df.size)) {
      sizeMap.set(df.size, []);
    }
    sizeMap.get(df.size).push(df);
  });

  let fixedCount = 0;
  const updatedMemories = [];

  for (const df of diskFiles) {
    const matchingDbFiles = dbFileList.filter(dbF => {
      try {
        const expectedSize = fs.statSync(path.join(UPLOADS_DIR, dbF.filename)).size;
        return df.size === expectedSize;
      } catch (e) {
        return false;
      }
    });

    if (matchingDbFiles.length === 1 && df.name !== matchingDbFiles[0].filename) {
      const oldPath = path.join(UPLOADS_DIR, df.name);
      const newPath = path.join(UPLOADS_DIR, matchingDbFiles[0].filename);

      fs.renameSync(oldPath, newPath);
      console.log(`\n重命名: ${df.name}`);
      console.log(`       → ${matchingDbFiles[0].filename}`);
      fixedCount++;
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
