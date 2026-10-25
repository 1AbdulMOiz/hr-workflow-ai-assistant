import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'hr.db');

// Single shared connection. better-sqlite3 is synchronous, which keeps the
// service layer simple and makes the AI tools easy to reason about.
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
export { DB_PATH, __dirname };
