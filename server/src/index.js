import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app.js';
import { getTodayDate } from './db-utils.js';
import { getAllRecords } from './db-local.js';
import { ensureExcelFiles, refreshExcelFiles, EXPORTS_DIR } from './excel-export.js';
import { runDailyBackup } from './db-backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 3001;
const app = createApp();

(async () => {
  try {
    console.log(`Daily reset active — today: ${getTodayDate()} (local)`);
    const records = await getAllRecords();
    await ensureExcelFiles(records);
    if (records.length) await refreshExcelFiles(records);
    console.log(`Excel exports: ${EXPORTS_DIR}`);
    const backup = runDailyBackup();
    if (backup.success) console.log(`SQLite backup: ${backup.path}`);
  } catch (e) {
    console.warn('Startup:', e.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ==========================================');
    console.log('   ATTENDANCE HUB - Server Running');
    console.log('  ==========================================');
    console.log(`   Employee:  http://localhost:${PORT}`);
    console.log(`   Admin:     http://localhost:${PORT}/admin`);
    console.log(`   Storage:   SQLite + Excel (auto-sync)`);
    console.log(`   Password:  ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    console.log('  ==========================================');
    console.log('');
  });
})();