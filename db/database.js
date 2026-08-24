const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'scheduler.db');
const db = new sqlite3.Database(dbPath);

// Enable foreign key constraints
db.run('PRAGMA foreign_keys = ON');

function initDb() {
  return new Promise((resolve, reject) => {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    db.exec(schemaSql, (err) => {
      if (err) {
        console.error('Error initializing SQLite schema:', err);
        reject(err);
      } else {
        console.log('SQLite database schema & v_poll_results view created successfully.');
        resolve();
      }
    });
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = {
  db,
  initDb,
  query,
  get,
  run
};
