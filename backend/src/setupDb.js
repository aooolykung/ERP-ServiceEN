import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const setupDatabase = async () => {
  console.log('Initializing database schema and seed data...');
  try {
    const schemaPath = path.join(__dirname, '../schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Split SQL by semicolon, but handle complex statements carefully if any
    // For simple migrations, executing the entire block is fine
    await pool.query(sql);

    console.log('Database initialized successfully with seed data!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
};

setupDatabase();
