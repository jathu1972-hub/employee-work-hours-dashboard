const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'server', 'data', 'attendance.db');

if (fs.existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath);
  db.exec('DELETE FROM attendance');
  console.log('Cleared attendance table in', dbPath);
}

console.log('Local reset complete.');