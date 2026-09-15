import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { db, validId } from '../db.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const uploadFile = (req, res, next) => upload.single('file')(req, res, (error) => {
  if (!error) return next();
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '文件不能超过 50MB，请压缩文件或拆分后上传' });
  }
  return res.status(400).json({ error: `文件上传失败: ${error.message}` });
});

async function baiduToken() {
  const key = process.env.BAIDU_API_KEY; const secret = process.env.BAIDU_SECRET_KEY;
  if (!key || !secret) throw new Error('未配置百度接口密钥，请设置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY');
  const r = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(key)}&client_secret=${encodeURIComponent(secret)}`);
  const d = await r.json(); if (!r.ok || !d.access_token) throw new Error(d.error_description || '百度接口鉴权失败');
  return d.access_token;
}

async function ocrPdf(buffer, token) {
  const form = new URLSearchParams({ pdf_file: buffer.toString('base64'), pdf_file_num: '1' });
  const r = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/doc_analysis_office?access_token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  const d = await r.json();
  if (!r.ok || d.error_code) throw new Error(d.error_msg || '百度文档 OCR 失败');
  return (d.pages_content || d.results || []).map((p) => p.content || p.words || '').join('\n');
}

async function splitByBaidu(text, grade = '一年级') {
  const token = await baiduToken();
  const endpoint = process.env.BAIDU_CHAT_URL || 'https://qianfan.baidubce.com/v2/chat/completions';
  const body = { model: process.env.BAIDU_MODEL || 'ernie-4.0-turbo-8k', messages: [{ role: 'user', content: `你是小学${grade}老师。请从下面教材/试卷内容中拆解出题目，返回纯JSON数组，不要markdown。每题字段：prompt题干、visual适合儿童的emoji、options四个选项（第一个是答案）、answer、type、knowledge、explain（儿童易懂的讲解）。没有完整题目就不要编造。内容：\n${text.slice(0, 50000)}` }], temperature: 0.2, max_tokens: 6000 };
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || d.error_msg || '百度知识拆解失败');
  const content = d.choices?.[0]?.message?.content || d.result || '';
  const match = String(content).match(/\[[\s\S]*\]/); if (!match) throw new Error('百度返回内容不是有效题目列表');
  return JSON.parse(match[0]).filter((q) => q.prompt).map((q, i) => ({ id: `custom-${Date.now()}-${i}`, ...q, options: q.options?.slice(0, 4) || [], answer: q.options?.[0] || q.answer, custom: true }));
}

router.post('/question-banks/import', uploadFile, async (req, res) => {
  const profileId = Number(req.body?.profileId);
  if (!validId(profileId) || !db.prepare('SELECT 1 FROM profiles WHERE id=?').get(profileId)) return res.status(400).json({ error: '档案无效' });
  if (!req.file) return res.status(400).json({ error: '请选择 Word 或 PDF 文件' });
  try {
    let text = '';
    if (/\.docx$/i.test(req.file.originalname)) text = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
    else if (/\.doc$/i.test(req.file.originalname)) throw new Error('暂不支持旧版 .doc，请另存为 .docx 后上传');
    else { const pdf = new PDFParse({ data: req.file.buffer }); const result = await pdf.getText(); text = result.text; await pdf.destroy(); }
    const token = await baiduToken();
    if (!text.trim() && /\.pdf$/i.test(req.file.originalname)) text = await ocrPdf(req.file.buffer, token);
    if (!text.trim()) throw new Error('文件没有可读取的文字，百度 OCR 也没有识别出内容');
    const profile = db.prepare('SELECT grade FROM profiles WHERE id=?').get(profileId);
    const questions = await splitByBaidu(text, profile?.grade);
    if (!questions.length) throw new Error('没有识别到完整题目');
    db.prepare('INSERT INTO custom_question_banks (profile_id,name,source_type,source_name,questions) VALUES (?,?,?,?,?)').run(profileId, '★ 我的题库', /\.pdf$/i.test(req.file.originalname) ? 'pdf' : 'word', req.file.originalname, JSON.stringify(questions));
    res.json({ ok: true, count: questions.length, name: '★ 我的题库', questions });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.delete('/question-banks/:id', (req, res) => {
  const profileId = Number(req.body?.profileId);
  if (!validId(profileId) || !validId(req.params.id)) return res.status(400).json({ error: '参数无效' });
  db.prepare('DELETE FROM custom_question_banks WHERE id=? AND profile_id=?').run(Number(req.params.id), profileId);
  return res.status(204).end();
});

router.get('/question-banks', (req, res) => {
  const id = Number(req.query.profileId); if (!validId(id)) return res.status(400).json({ error: '缺少档案' });
  const rows = db.prepare('SELECT id,name,source_type AS sourceType,source_name AS sourceName,questions,created_at AS createdAt FROM custom_question_banks WHERE profile_id=? ORDER BY created_at DESC').all(id);
  res.json(rows.map((r) => ({ ...r, questions: JSON.parse(r.questions) })));
});
export default router;
