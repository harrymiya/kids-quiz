// 存储层：SQLite 连接 / 表结构 / 迁移 / 应用设置 / 通用校验
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
mkdirSync(resolve(root, 'data'), { recursive: true });

export const db = new DatabaseSync(resolve(root, 'data/kids-quiz.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🧒',
    age INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS review_progress (
    profile_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    stage INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    next_review_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, question_id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    correct INTEGER NOT NULL,
    answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS mistakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    knowledge TEXT NOT NULL DEFAULT '综合',
    prompt TEXT NOT NULL DEFAULT '',
    visual TEXT NOT NULL DEFAULT '',
    answer TEXT NOT NULL DEFAULT '',
    options TEXT NOT NULL DEFAULT '[]',
    picked TEXT NOT NULL DEFAULT '',
    explain TEXT NOT NULL DEFAULT '',
    wrong_count INTEGER NOT NULL DEFAULT 1,
    mastered INTEGER NOT NULL DEFAULT 0,
    last_wrong_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (profile_id, question_id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    subject_id TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT '闯关',
    total INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    detail TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS learning_tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    goal TEXT NOT NULL,
    steps TEXT NOT NULL DEFAULT '[]',
    result TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS custom_question_banks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL DEFAULT '',
    questions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );
`);

const columnsOf = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
const ensureColumn = (table, column, ddl) => {
  if (!columnsOf(table).includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
};
ensureColumn('profiles', 'grade', "TEXT NOT NULL DEFAULT '一年级'");
ensureColumn('attempts', 'knowledge', "TEXT NOT NULL DEFAULT '综合'");
ensureColumn('attempts', 'picked', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attempts', 'prompt', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attempts', 'visual', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attempts', 'options', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('attempts', 'explain', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attempts', 'answer', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attempts', 'intervention', "TEXT NOT NULL DEFAULT 'standard'");

if (db.prepare('SELECT COUNT(*) AS count FROM profiles').get().count === 0) {
  db.prepare("INSERT INTO profiles (name, avatar, age, grade) VALUES (?, ?, ?, ?)").run('小探险家', '🧒', 7, '一年级');
}

// 应用设置（存数据库）：设置页保存，重启不丢失，不进 Git（data/ 已忽略）
export const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
export const setSetting = (key, value) => {
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(key, value);
};
export const maskKey = (key) => (!key ? '' : key.length <= 7 ? '***' : `${key.slice(0, 3)}...${key.slice(-3)}`);

// 通用校验
export const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
export const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
export const normalizeGrade = (value, fallback = '一年级') => (GRADES.includes(value) ? value : fallback);
export const rootDir = root;

export const jsonValue = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
