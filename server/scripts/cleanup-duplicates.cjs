const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'memoflow.db.json');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'vault', 'uploads');

function getFileHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function cleanupDuplicates() {
  console.log('=== 清理重复文件开始 ===\n');

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('uploads 目录不存在');
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  console.log(`上传目录文件数: ${files.length}`);

  const hashMap = new Map();
  const duplicates = [];

  for (const file of files) {
    const filePath = path.join(UPLOADS_DIR, file);
    if (!fs.statSync(filePath).isFile()) continue;

    const hash = getFileHash(filePath);
    if (!hashMap.has(hash)) {
      hashMap.set(hash, []);
    }
    hashMap.get(hash).push(file);
  }

  for (const [hash, fileList] of hashMap) {
    if (fileList.length > 1) {
      const sizes = fileList.map(f => fs.statSync(path.join(UPLOADS_DIR, f)).size);
      console.log(`\n发现重复 (${fileList.length}个):`);
      fileList.forEach((f, i) => {
        const marker = i === 0 ? '(保留)' : '(删除)';
        console.log(`  ${marker} ${f} (${sizes[i]} bytes)`);
        if (i > 0) {
          duplicates.push(f);
        }
      });
    }
  }

  if (duplicates.length === 0) {
    console.log('\n没有重复文件');
    return;
  }

  console.log(`\n准备删除 ${duplicates.length} 个重复文件...`);

  for (const file of duplicates) {
    const filePath = path.join(UPLOADS_DIR, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`已删除: ${file}`);
    } catch (err) {
      console.error(`删除失败: ${file} - ${err.message}`);
    }
  }

  console.log(`\n=== 清理完成 ===`);
  console.log(`删除了 ${duplicates.length} 个重复文件`);
}

try {
  cleanupDuplicates();
} catch (err) {
  console.error('清理失败:', err);
}
