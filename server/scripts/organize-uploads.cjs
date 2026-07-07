const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'memoflow.db.json');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'vault', 'uploads');
const MEMORIES_DIR = path.join(__dirname, '..', '..', 'vault', 'memories');

function getFileCategory(filename, mimetype) {
  const ext = path.extname(filename).toLowerCase().slice(1);

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext) || (mimetype || '').startsWith('image/')) {
    return 'images';
  }
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archives';
  return 'others';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function organizeUploads() {
  console.log('=== 按类型整理 uploads 目录 ===\n');

  const categories = ['images', 'word', 'excel', 'ppt', 'pdf', 'archives', 'others'];
  categories.forEach(cat => ensureDir(path.join(UPLOADS_DIR, cat)));

  const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const memories = dbData.memories || [];

  const fileToMemory = new Map();
  for (const m of memories) {
    if (!m.files_json) continue;
    try {
      const files = JSON.parse(m.files_json);
      if (Array.isArray(files)) {
        for (const f of files) {
          fileToMemory.set(path.basename(f.path), {
            memoryId: m.id,
            fileData: f,
          });
        }
      }
    } catch (e) {}
  }

  const allFiles = fs.readdirSync(UPLOADS_DIR).filter(f => {
    const fullPath = path.join(UPLOADS_DIR, f);
    return fs.statSync(fullPath).isFile();
  });

  console.log(`uploads 根目录有 ${allFiles.length} 个文件需要迁移\n`);

  const pathUpdates = [];

  for (const file of allFiles) {
    const oldPath = path.join(UPLOADS_DIR, file);
    const info = fileToMemory.get(file);

    let mimetype = info?.fileData?.mimetype || '';
    let category = getFileCategory(file, mimetype);
    let newPath = path.join(UPLOADS_DIR, category, file);

    if (fs.existsSync(newPath)) {
      console.log(`跳过(已存在): ${category}/${file}`);
      continue;
    }

    fs.renameSync(oldPath, newPath);
    console.log(`迁移: ${file} -> ${category}/${file}`);

    if (info) {
      pathUpdates.push({
        memoryId: info.memoryId,
        oldPath: info.fileData.path,
        newPath: newPath,
        fileData: info.fileData,
      });
    }
  }

  console.log(`\n=== 更新数据库路径 ===`);

  for (const update of pathUpdates) {
    for (const m of memories) {
      if (m.id !== update.memoryId) continue;
      if (!m.files_json) continue;

      try {
        const files = JSON.parse(m.files_json);
        if (Array.isArray(files)) {
          for (const f of files) {
            if (path.basename(f.path) === path.basename(update.oldPath)) {
              f.path = update.newPath;
            }
          }
          m.files_json = JSON.stringify(files);
        }
      } catch (e) {}
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
  console.log(`更新了 ${pathUpdates.length} 条数据库记录`);

  console.log(`\n=== 更新 Markdown 附件引用 ===`);

  let mdUpdated = 0;
  for (const update of pathUpdates) {
    for (const m of memories) {
      if (m.id !== update.memoryId) continue;

      const mdPath = m.file_path;
      if (!mdPath || !fs.existsSync(mdPath)) continue;

      let content = fs.readFileSync(mdPath, 'utf-8');
      const oldBasename = path.basename(update.oldPath);
      const newLink = `${path.basename(path.dirname(update.newPath))}/${oldBasename}`;

      if (content.includes(`![[${oldBasename}]]`)) {
        content = content.replace(`![[${oldBasename}]]`, `![[${newLink}]]`);
      }
      if (content.includes(`[[${oldBasename}]]`)) {
        content = content.replace(`[[${oldBasename}]]`, `[[${newLink}]]`);
      }

      fs.writeFileSync(mdPath, content, 'utf-8');
      mdUpdated++;
    }
  }
  console.log(`更新了 ${mdUpdated} 个 Markdown 文件`);

  console.log(`\n=== 迁移完成 ===`);

  console.log('\n最终目录结构:');
  for (const cat of categories) {
    const catDir = path.join(UPLOADS_DIR, cat);
    if (fs.existsSync(catDir)) {
      const files = fs.readdirSync(catDir).filter(f => fs.statSync(path.join(catDir, f)).isFile());
      if (files.length > 0) {
        console.log(`  ${cat}/ (${files.length} 个文件)`);
        files.forEach(f => console.log(`    - ${f}`));
      }
    }
  }
}

try {
  organizeUploads();
} catch (err) {
  console.error('迁移失败:', err);
}
