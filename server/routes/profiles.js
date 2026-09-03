// 路由：个人档案 CRUD
import { Router } from 'express';
import { db, normalizeGrade, validId } from '../db.js';

const router = Router();

router.get('/profiles', (_request, response) => {
  response.json(db.prepare(`
    SELECT p.*, COUNT(a.id) AS attempts,
      COALESCE(SUM(a.correct), 0) AS correct_answers
    FROM profiles p LEFT JOIN attempts a ON a.profile_id = p.id
    GROUP BY p.id ORDER BY p.created_at
  `).all());
});

router.post('/profiles', (request, response) => {
  const name = String(request.body.name || '').trim().slice(0, 20);
  const avatar = String(request.body.avatar || '🧒').slice(0, 8);
  const age = request.body.age ? Math.min(18, Math.max(3, Number(request.body.age))) : null;
  const grade = normalizeGrade(request.body.grade);
  if (!name) return response.status(400).json({ error: '请输入姓名或昵称' });
  const result = db.prepare('INSERT INTO profiles (name, avatar, age, grade) VALUES (?, ?, ?, ?)').run(name, avatar, age, grade);
  return response.status(201).json(db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/profiles/:id', (request, response) => {
  if (!validId(request.params.id)) return response.status(400).json({ error: '无效的档案编号' });
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(request.params.id);
  if (!profile) return response.status(404).json({ error: '档案不存在' });
  const name = String(request.body.name ?? profile.name).trim().slice(0, 20) || profile.name;
  const avatar = String(request.body.avatar ?? profile.avatar).slice(0, 8);
  const age = request.body.age ? Math.min(18, Math.max(3, Number(request.body.age))) : null;
  const grade = request.body.grade === undefined ? (profile.grade || '一年级') : normalizeGrade(request.body.grade, profile.grade || '一年级');
  db.prepare('UPDATE profiles SET name = ?, avatar = ?, age = ?, grade = ? WHERE id = ?').run(name, avatar, age, grade, request.params.id);
  return response.json(db.prepare('SELECT * FROM profiles WHERE id = ?').get(request.params.id));
});

router.delete('/profiles/:id', (request, response) => {
  const count = db.prepare('SELECT COUNT(*) AS count FROM profiles').get().count;
  if (count <= 1) return response.status(409).json({ error: '至少保留一个个人档案' });
  db.prepare('DELETE FROM profiles WHERE id = ?').run(request.params.id);
  return response.status(204).end();
});

export default router;
