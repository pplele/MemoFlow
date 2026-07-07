const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'vault', 'uploads');

const renameMap = [
  { from: '1783444327866______________20260704233604_468_1.jpg', to: '1783444904695_微信图片_20260704233604_468_1.jpg' },
  { from: '1783444327878______________20260704233607_469_1.jpg', to: '1783444904706_微信图片_20260704233607_469_1.jpg' },
  { from: '1783447544937_2025__________________.xlsx', to: '1783448129627_2025年度财经报告.xlsx' },
];

function fixFilenames() {
  console.log('=== 手动修复文件名 ===\n');

  let fixedCount = 0;

  for (const item of renameMap) {
    const oldPath = path.join(UPLOADS_DIR, item.from);
    const newPath = path.join(UPLOADS_DIR, item.to);

    if (fs.existsSync(oldPath)) {
      if (fs.existsSync(newPath)) {
        console.log(`跳过: ${item.to} 已存在`);
      } else {
        fs.renameSync(oldPath, newPath);
        console.log(`重命名: ${item.from}`);
        console.log(`       → ${item.to}`);
        fixedCount++;
      }
    } else {
      console.log(`跳过: ${item.from} 不存在`);
    }
  }

  console.log(`\n=== 修复完成 ===`);
  console.log(`修复了 ${fixedCount} 个文件名`);

  console.log('\n当前文件列表:');
  const files = fs.readdirSync(UPLOADS_DIR);
  files.forEach(f => console.log(`  ${f}`));
}

try {
  fixFilenames();
} catch (err) {
  console.error('修复失败:', err);
}
