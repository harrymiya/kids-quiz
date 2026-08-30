import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
mkdirSync(resolve(root, 'data'), { recursive: true });
const db = new DatabaseSync(resolve(root, 'data/kids-quiz.db'));
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
`);
if (db.prepare('SELECT COUNT(*) AS count FROM profiles').get().count === 0) {
  db.prepare('INSERT INTO profiles (name, avatar, age) VALUES (?, ?, ?)').run('小探险家', '🧒', 7);
}

const app = express();
app.use(express.json());
const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

app.get('/api/profiles', (_request, response) => {
  response.json(db.prepare(`
    SELECT p.*, COUNT(a.id) AS attempts,
      COALESCE(SUM(a.correct), 0) AS correct_answers
    FROM profiles p LEFT JOIN attempts a ON a.profile_id = p.id
    GROUP BY p.id ORDER BY p.created_at
  `).all());
});

app.post('/api/profiles', (request, response) => {
  const name = String(request.body.name || '').trim().slice(0, 20);
  const avatar = String(request.body.avatar || '🧒').slice(0, 8);
  const age = request.body.age ? Math.min(18, Math.max(3, Number(request.body.age))) : null;
  if (!name) return response.status(400).json({ error: '请输入姓名或昵称' });
  const result = db.prepare('INSERT INTO profiles (name, avatar, age) VALUES (?, ?, ?)').run(name, avatar, age);
  return response.status(201).json(db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/profiles/:id', (request, response) => {
  if (!validId(request.params.id)) return response.status(400).json({ error: '无效的档案编号' });
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(request.params.id);
  if (!profile) return response.status(404).json({ error: '档案不存在' });
  const name = String(request.body.name || profile.name).trim().slice(0, 20);
  const avatar = String(request.body.avatar || profile.avatar).slice(0, 8);
  const age = request.body.age ? Math.min(18, Math.max(3, Number(request.body.age))) : null;
  db.prepare('UPDATE profiles SET name = ?, avatar = ?, age = ? WHERE id = ?').run(name, avatar, age, request.params.id);
  return response.json(db.prepare('SELECT * FROM profiles WHERE id = ?').get(request.params.id));
});

app.delete('/api/profiles/:id', (request, response) => {
  const count = db.prepare('SELECT COUNT(*) AS count FROM profiles').get().count;
  if (count <= 1) return response.status(409).json({ error: '至少保留一个个人档案' });
  db.prepare('DELETE FROM profiles WHERE id = ?').run(request.params.id);
  return response.status(204).end();
});

app.get('/api/reviews/due', (request, response) => {
  const { profileId, subjectId } = request.query;
  if (!validId(profileId) || !subjectId) return response.status(400).json({ error: '缺少档案或学科' });
  const rows = db.prepare(`
    SELECT question_id AS questionId, stage, correct_count AS correctCount,
      wrong_count AS wrongCount, next_review_at AS nextReviewAt
    FROM review_progress
    WHERE profile_id = ? AND subject_id = ? AND next_review_at <= CURRENT_TIMESTAMP
    ORDER BY wrong_count DESC, next_review_at ASC
  `).all(profileId, subjectId);
  response.json(rows);
});

app.post('/api/attempts', (request, response) => {
  const { profileId, questionId, subjectId, correct } = request.body;
  if (!validId(profileId) || !questionId || !subjectId || typeof correct !== 'boolean') {
    return response.status(400).json({ error: '作答数据不完整' });
  }
  const current = db.prepare('SELECT * FROM review_progress WHERE profile_id = ? AND question_id = ?').get(profileId, questionId);
  const previousStage = current?.stage || 0;
  const stage = correct ? Math.min(5, previousStage + 1) : 0;
  const intervals = [0, 1, 3, 7, 14, 30];
  const nextDate = new Date(Date.now() + intervals[stage] * 86400000);
  const nextReview = nextDate.toISOString().slice(0, 19).replace('T', ' ');
  try {
    db.exec('BEGIN');
    db.prepare('INSERT INTO attempts (profile_id, question_id, subject_id, correct) VALUES (?, ?, ?, ?)').run(profileId, questionId, subjectId, correct ? 1 : 0);
    db.prepare(`
      INSERT INTO review_progress (profile_id, question_id, subject_id, stage, correct_count, wrong_count, next_review_at, last_answered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(profile_id, question_id) DO UPDATE SET
        stage = excluded.stage,
        correct_count = review_progress.correct_count + excluded.correct_count,
        wrong_count = review_progress.wrong_count + excluded.wrong_count,
        next_review_at = excluded.next_review_at,
        last_answered_at = CURRENT_TIMESTAMP
    `).run(profileId, questionId, subjectId, stage, correct ? 1 : 0, correct ? 0 : 1, nextReview);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    return response.status(500).json({ error: '保存作答记录失败' });
  }
  return response.status(201).json({ stage, intervalDays: intervals[stage], nextReviewAt: nextReview });
});

app.get('/api/profiles/:id/memory', (request, response) => {
  const rows = db.prepare(`
    SELECT subject_id AS subjectId, COUNT(*) AS learned,
      SUM(CASE WHEN stage >= 3 THEN 1 ELSE 0 END) AS mastered,
      SUM(CASE WHEN next_review_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS due
    FROM review_progress WHERE profile_id = ? GROUP BY subject_id
  `).all(request.params.id);
  response.json(rows);
});

if (process.env.NODE_ENV === 'production') app.use(express.static(resolve(root, 'dist')));
const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`Kids Quiz API: http://localhost:${port}`));
