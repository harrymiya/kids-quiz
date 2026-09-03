// 路由：学习数据——课程体系 / 记忆复习 / 作答 / 错题本 / 掌握度 / 闯关记录 / 打卡
import { Router } from 'express';
import { db, validId } from '../db.js';
import { KNOWLEDGE } from '../../src/curriculum.js';

const router = Router();

// 课程体系（可扩展知识内容）
router.get('/curriculum', (_request, response) => {
  response.json(KNOWLEDGE);
});

// 记忆复习：到期题目
router.get('/reviews/due', (request, response) => {
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

// 作答：记忆曲线推进 + 错题本自动归集
router.post('/attempts', (request, response) => {
  const { profileId, questionId, subjectId, correct, knowledge, picked, prompt, visual, options, explain } = request.body;
  if (!validId(profileId) || !questionId || !subjectId || typeof correct !== 'boolean') {
    return response.status(400).json({ error: '作答数据不完整' });
  }
  const k = String(knowledge || '综合').slice(0, 40);
  const current = db.prepare('SELECT * FROM review_progress WHERE profile_id = ? AND question_id = ?').get(profileId, questionId);
  const previousStage = current?.stage || 0;
  const stage = correct ? Math.min(5, previousStage + 1) : 0;
  const intervals = [0, 1, 3, 7, 14, 30];
  const nextDate = new Date(Date.now() + intervals[stage] * 86400000);
  const nextReview = nextDate.toISOString().slice(0, 19).replace('T', ' ');
  const snap = {
    picked: String(picked ?? '').slice(0, 200),
    prompt: String(prompt ?? '').slice(0, 300),
    visual: String(visual ?? '').slice(0, 100),
    options: JSON.stringify(Array.isArray(options) ? options.slice(0, 6) : []),
    explain: String(explain ?? '').slice(0, 500),
  };
  try {
    db.exec('BEGIN');
    db.prepare('INSERT INTO attempts (profile_id, question_id, subject_id, correct, knowledge, picked, prompt, visual, options, explain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(profileId, questionId, subjectId, correct ? 1 : 0, k, snap.picked, snap.prompt, snap.visual, snap.options, snap.explain);
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
    if (!correct) {
      db.prepare(`
        INSERT INTO mistakes (profile_id, question_id, subject_id, knowledge, prompt, visual, answer, options, picked, explain, wrong_count, mastered, last_wrong_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(profile_id, question_id) DO UPDATE SET
          knowledge = excluded.knowledge, prompt = excluded.prompt, visual = excluded.visual,
          answer = excluded.answer, options = excluded.options, picked = excluded.picked,
          explain = excluded.explain, wrong_count = mistakes.wrong_count + 1,
          mastered = 0, last_wrong_at = CURRENT_TIMESTAMP
      `).run(profileId, questionId, subjectId, k, snap.prompt, snap.visual, String(request.body.answer ?? '').slice(0, 200), snap.options, snap.picked, snap.explain);
    } else if (stage >= 2) {
      // 同一题连对进入稳定记忆：自动从错题本毕业
      db.prepare('UPDATE mistakes SET mastered = 1 WHERE profile_id = ? AND question_id = ?').run(profileId, questionId);
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    return response.status(500).json({ error: '保存作答记录失败' });
  }
  return response.status(201).json({ stage, intervalDays: intervals[stage], nextReviewAt: nextReview });
});

// 错题本
router.get('/mistakes', (request, response) => {
  const { profileId, subjectId, mastered } = request.query;
  if (!validId(profileId)) return response.status(400).json({ error: '缺少档案' });
  let sql = 'SELECT * FROM mistakes WHERE profile_id = ?';
  const params = [profileId];
  if (subjectId) { sql += ' AND subject_id = ?'; params.push(subjectId); }
  if (mastered === '0' || mastered === '1') { sql += ' AND mastered = ?'; params.push(Number(mastered)); }
  sql += ' ORDER BY mastered ASC, wrong_count DESC, last_wrong_at DESC LIMIT 200';
  response.json(db.prepare(sql).all(...params));
});

router.post('/mistakes/:id/mastered', (request, response) => {
  const { mastered = true } = request.body;
  db.prepare('UPDATE mistakes SET mastered = ? WHERE id = ?').run(mastered ? 1 : 0, request.params.id);
  response.json({ ok: true });
});

// 知识点掌握度（跟踪每个用户的答题情况）
router.get('/profiles/:id/mastery', (request, response) => {
  const rows = db.prepare(`
    SELECT subject_id AS subjectId, knowledge,
      COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct,
      MAX(answered_at) AS lastAnsweredAt
    FROM attempts WHERE profile_id = ? GROUP BY subject_id, knowledge
  `).all(request.params.id);
  const memory = db.prepare(`
    SELECT subject_id AS subjectId, COUNT(*) AS learned,
      SUM(CASE WHEN stage >= 3 THEN 1 ELSE 0 END) AS masteredCount,
      SUM(CASE WHEN next_review_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS due
    FROM review_progress WHERE profile_id = ? GROUP BY subject_id
  `).all(request.params.id);
  const mistakes = db.prepare(`
    SELECT subject_id AS subjectId, COUNT(*) AS count
    FROM mistakes WHERE profile_id = ? AND mastered = 0 GROUP BY subject_id
  `).all(request.params.id);
  response.json({ knowledge: rows, memory, mistakes });
});

router.get('/profiles/:id/memory', (request, response) => {
  const rows = db.prepare(`
    SELECT subject_id AS subjectId, COUNT(*) AS learned,
      SUM(CASE WHEN stage >= 3 THEN 1 ELSE 0 END) AS mastered,
      SUM(CASE WHEN next_review_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS due
    FROM review_progress WHERE profile_id = ? GROUP BY subject_id
  `).all(request.params.id);
  response.json(rows);
});

// 闯关记录
router.post('/sessions', (request, response) => {
  const { profileId, subjectId, mode, total, correct, level, detail } = request.body;
  if (!validId(profileId) || !subjectId || typeof total !== 'number') {
    return response.status(400).json({ error: '记录数据不完整' });
  }
  const result = db.prepare('INSERT INTO sessions (profile_id, subject_id, mode, total, correct, level, detail) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(profileId, subjectId, String(mode || '闯关').slice(0, 20), total, Number(correct) || 0, Number(level) || 1,
      JSON.stringify(Array.isArray(detail) ? detail.slice(0, 30) : []));
  response.status(201).json({ id: result.lastInsertRowid });
});

router.get('/sessions', (request, response) => {
  const { profileId } = request.query;
  if (!validId(profileId)) return response.status(400).json({ error: '缺少档案' });
  response.json(db.prepare('SELECT * FROM sessions WHERE profile_id = ? ORDER BY created_at DESC LIMIT 30').all(profileId));
});

// 学习活跃：连续打卡天数（今天没学但昨天学了也算连续）+ 累计学习天数
router.get('/profiles/:id/activity', (request, response) => {
  const days = db.prepare('SELECT DISTINCT DATE(created_at) AS d FROM sessions WHERE profile_id = ? ORDER BY d DESC LIMIT 90')
    .all(request.params.id).map((r) => r.d);
  const fmt = (date) => date.toISOString().slice(0, 10);
  const today = new Date(); const yesterday = new Date(Date.now() - 86400000);
  let streak = 0;
  if (days[0] === fmt(today) || days[0] === fmt(yesterday)) {
    let cursor = days[0] === fmt(today) ? today : yesterday;
    for (const d of days) {
      if (d === fmt(cursor)) { streak += 1; cursor = new Date(cursor.getTime() - 86400000); }
      else break;
    }
  }
  response.json({ streakDays: streak, totalDays: days.length, lastActive: days[0] || null });
});

export default router;
