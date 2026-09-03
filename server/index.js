import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE } from '../src/curriculum.js';

// ---------- 大模型接入配置 ----------
// 模型不写死：只从配置读取，优先级：设置页(存数据库) > 环境变量。
// 网关地址/密钥最后才回退到内置值；模型没有内置默认值，未配置会明确提示去设置页选择。
// 例：LLM_BASE_URL=... LLM_API_KEY=... LLM_MODEL=... LLM_FALLBACKS=模型A,模型B
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://codex.xyingsoft.com/v1';
// 密钥不进代码仓库：从设置页（存本地数据库）或环境变量读取
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || '';
const LLM_FALLBACKS_DEFAULT = process.env.LLM_FALLBACKS || '';

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

// 应用设置(存数据库)：设置页保存，重启不丢失，不进 Git(data/ 已忽略)
const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
const setSetting = (key, value) => {
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(key, value);
};
const maskKey = (key) => (!key ? '' : key.length <= 7 ? '***' : `${key.slice(0, 3)}...${key.slice(-3)}`);

// 解析生效的大模型配置：数据库 > 环境变量 > 内置(地址/密钥)；模型无内置默认值
const resolveLLM = () => {
  const baseUrl = (getSetting('llm_base_url') || LLM_BASE_URL).replace(/\/$/, '');
  const apiKey = getSetting('llm_api_key') || LLM_API_KEY;
  const model = getSetting('llm_model') || LLM_MODEL;
  const fallbacks = (getSetting('llm_fallbacks') || LLM_FALLBACKS_DEFAULT).split(',').map((s) => s.trim()).filter(Boolean);
  return { baseUrl, apiKey, model, fallbacks };
};

if (db.prepare('SELECT COUNT(*) AS count FROM profiles').get().count === 0) {
  db.prepare("INSERT INTO profiles (name, avatar, age, grade) VALUES (?, ?, ?, ?)").run('小探险家', '🧒', 7, '一年级');
}

const app = express();
app.use(express.json({ limit: '1mb' }));
const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
const normalizeGrade = (value, fallback = '一年级') => (GRADES.includes(value) ? value : fallback);

// ---------- 档案 ----------
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
  const grade = normalizeGrade(request.body.grade);
  if (!name) return response.status(400).json({ error: '请输入姓名或昵称' });
  const result = db.prepare('INSERT INTO profiles (name, avatar, age, grade) VALUES (?, ?, ?, ?)').run(name, avatar, age, grade);
  return response.status(201).json(db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/profiles/:id', (request, response) => {
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

app.delete('/api/profiles/:id', (request, response) => {
  const count = db.prepare('SELECT COUNT(*) AS count FROM profiles').get().count;
  if (count <= 1) return response.status(409).json({ error: '至少保留一个个人档案' });
  db.prepare('DELETE FROM profiles WHERE id = ?').run(request.params.id);
  return response.status(204).end();
});

// ---------- 课程体系(可扩展知识内容) ----------
app.get('/api/curriculum', (_request, response) => {
  response.json(KNOWLEDGE);
});

// ---------- 记忆复习 ----------
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

// ---------- 作答:记忆曲线 + 错题本自动归集 ----------
app.post('/api/attempts', (request, response) => {
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
      // 错题本归集:同题累计错次,覆盖最新作答快照
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
      // 同一题连对进入稳定记忆:自动从错题本毕业
      db.prepare('UPDATE mistakes SET mastered = 1 WHERE profile_id = ? AND question_id = ?').run(profileId, questionId);
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    return response.status(500).json({ error: '保存作答记录失败' });
  }
  return response.status(201).json({ stage, intervalDays: intervals[stage], nextReviewAt: nextReview });
});

// ---------- 错题本 ----------
app.get('/api/mistakes', (request, response) => {
  const { profileId, subjectId, mastered } = request.query;
  if (!validId(profileId)) return response.status(400).json({ error: '缺少档案' });
  let sql = 'SELECT * FROM mistakes WHERE profile_id = ?';
  const params = [profileId];
  if (subjectId) { sql += ' AND subject_id = ?'; params.push(subjectId); }
  if (mastered === '0' || mastered === '1') { sql += ' AND mastered = ?'; params.push(Number(mastered)); }
  sql += ' ORDER BY mastered ASC, wrong_count DESC, last_wrong_at DESC LIMIT 200';
  response.json(db.prepare(sql).all(...params));
});

app.post('/api/mistakes/:id/mastered', (request, response) => {
  const { mastered = true } = request.body;
  db.prepare('UPDATE mistakes SET mastered = ? WHERE id = ?').run(mastered ? 1 : 0, request.params.id);
  response.json({ ok: true });
});

// ---------- 知识点掌握度(跟踪每个用户的答题情况) ----------
app.get('/api/profiles/:id/mastery', (request, response) => {
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

app.get('/api/profiles/:id/memory', (request, response) => {
  const rows = db.prepare(`
    SELECT subject_id AS subjectId, COUNT(*) AS learned,
      SUM(CASE WHEN stage >= 3 THEN 1 ELSE 0 END) AS mastered,
      SUM(CASE WHEN next_review_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS due
    FROM review_progress WHERE profile_id = ? GROUP BY subject_id
  `).all(request.params.id);
  response.json(rows);
});

// ---------- 闯关记录 ----------
app.post('/api/sessions', (request, response) => {
  const { profileId, subjectId, mode, total, correct, level, detail } = request.body;
  if (!validId(profileId) || !subjectId || typeof total !== 'number') {
    return response.status(400).json({ error: '记录数据不完整' });
  }
  const result = db.prepare('INSERT INTO sessions (profile_id, subject_id, mode, total, correct, level, detail) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(profileId, subjectId, String(mode || '闯关').slice(0, 20), total, Number(correct) || 0, Number(level) || 1,
      JSON.stringify(Array.isArray(detail) ? detail.slice(0, 30) : []));
  response.status(201).json({ id: result.lastInsertRowid });
});

app.get('/api/sessions', (request, response) => {
  const { profileId } = request.query;
  if (!validId(profileId)) return response.status(400).json({ error: '缺少档案' });
  response.json(db.prepare('SELECT * FROM sessions WHERE profile_id = ? ORDER BY created_at DESC LIMIT 30').all(profileId));
});

// 学习活跃：连续打卡天数（今天没学但昨天学了也算连续）+ 累计学习天数
app.get('/api/profiles/:id/activity', (request, response) => {
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

// ---------- 大模型代理(OpenAI 兼容协议，配置存数据库) ----------
app.get('/api/config', (_request, response) => {
  const { baseUrl, model, apiKey } = resolveLLM();
  response.json({
    llmBaseUrl: baseUrl,
    llmModel: model,
    llmModelConfigured: Boolean(model),
    llmConfigured: Boolean(apiKey),
    hint: model ? '' : '尚未配置模型，请到“设置”页选择并保存（可用🔍自动探测）。',
  });
});

// 设置页：读取 / 保存大模型配置（存数据库，重启不丢失）
app.get('/api/settings', (_request, response) => {
  const { baseUrl, apiKey, model, fallbacks } = resolveLLM();
  response.json({
    baseUrl: getSetting('llm_base_url'),
    model, fallbacks: fallbacks.join(','),
    hasApiKey: Boolean(getSetting('llm_api_key') || LLM_API_KEY),
    apiKeyPreview: maskKey(getSetting('llm_api_key') || LLM_API_KEY),
    effectiveBaseUrl: baseUrl,
    customized: Boolean(getSetting('llm_base_url') || getSetting('llm_api_key') || getSetting('llm_model') || getSetting('llm_fallbacks')),
  });
});

app.put('/api/settings', (request, response) => {
  const { baseUrl, apiKey, model, fallbacks } = request.body || {};
  if (baseUrl !== undefined) setSetting('llm_base_url', String(baseUrl).trim().replace(/\/$/, ''));
  if (apiKey !== undefined && String(apiKey).trim()) setSetting('llm_api_key', String(apiKey).trim());
  if (model !== undefined) setSetting('llm_model', String(model).trim());
  if (fallbacks !== undefined) setSetting('llm_fallbacks', String(fallbacks).split(',').map((s) => s.trim()).filter(Boolean).join(','));
  const saved = resolveLLM();
  response.json({ ok: true, model: saved.model, baseUrl: saved.baseUrl, apiKeyPreview: maskKey(saved.apiKey) });
});

// 恢复默认：清空数据库里的覆盖，回到环境变量 / 内置
app.delete('/api/settings', (_request, response) => {
  db.prepare("DELETE FROM settings WHERE key IN ('llm_base_url','llm_api_key','llm_model','llm_fallbacks')").run();
  response.json({ ok: true });
});

app.get('/api/models', async (_request, response) => {
  try {
    const { baseUrl, apiKey, model } = resolveLLM();
    const res = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    response.json({ models: (data.data || []).map((m) => m.id).sort(), currentModel: model });
  } catch (error) {
    response.status(502).json({ error: `模型列表获取失败:${error.message}` });
  }
});

// 网关按“模型×分组”动态分配上游通道，单个模型可能暂时无通道(如 No available channel)。
// 自动故障转移只在【已配置的候选】之间进行：所选模型 > 设置页兜底 > 环境变量兜底。key/余额类问题直接报错。
const RETRYABLE = /no available channel|temporarily unavailable|model_not_found|overload|rate.?limit|timeout|timed out|aborted|502|503|529/i;
const FATAL = /invalid.*(key|token)|unauthorized|incorrect api key|余额不足|insufficient/i;
// 明显不是文字对话模型的，按通用关键字过滤（动态发现时使用，不写死具体模型名）
const NON_CHAT_MODEL = /image|video|imagine|tts|whisper|embedding|moderation|audio|dall-e|stable/i;

const friendlyError = (message) => {
  if (!message) return '大模型服务异常';
  if (/尚未配置模型/.test(message)) return message;
  if (/no available channel/i.test(message)) return '所选模型当前没有可用通道，可到设置页换个模型或点🔍自动探测';
  if (/temporarily unavailable/i.test(message)) return '网关服务暂时不可用，稍后再试';
  if (/余额不足|insufficient/i.test(message)) return '密钥余额不足，请充值或更换密钥';
  if (FATAL.test(message)) return '密钥无效或未授权，请检查密钥';
  return message;
};

async function completeOnce({ baseUrl, apiKey, model }, messages, { temperature = 0.7, maxTokens = 800, timeout = 60000 } = {}) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error.message || `大模型服务异常(${res.status})`);
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('大模型返回为空');
  return { reply, model: data.model || model };
}

async function chatCompletion(config, messages, options = {}) {
  const candidates = [...new Set([config.model, ...(config.fallbacks || [])].filter(Boolean))];
  if (!candidates.length) throw new Error('尚未配置模型：请到“设置”页选择并保存模型（可用🔍自动探测）');
  let lastError = null;
  for (const model of candidates) {
    try {
      const result = await completeOnce({ ...config, model }, messages, options);
      return { ...result, requestedModel: config.model };
    } catch (error) {
      lastError = error;
      if (FATAL.test(error.message)) break; // key/余额问题：换模型也没用，直接报错
      if (!RETRYABLE.test(error.message)) break; // 未知错误：不盲目重试
    }
  }
  throw new Error(friendlyError(lastError?.message || '大模型服务异常'));
}

// 一键探测：用网关实时模型列表动态发现当前可用的模型（不过滤掉已配置的优先试）
app.post('/api/models/probe', async (_request, response) => {
  const config = resolveLLM();
  const tried = [];
  let candidates = [];
  if (config.model) candidates.push(config.model);
  candidates.push(...(config.fallbacks || []));
  try {
    const res = await fetch(`${config.baseUrl}/models`, { headers: { Authorization: `Bearer ${config.apiKey}` }, signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    const live = (data.data || []).map((m) => m.id).filter((id) => !NON_CHAT_MODEL.test(id));
    candidates.push(...live);
  } catch (error) {
    tried.push({ model: '(模型列表)', error: `拉取失败:${error.message}` });
  }
  candidates = [...new Set(candidates)].slice(0, 20);
  if (!candidates.length) return response.status(502).json({ error: '没有可探测的模型，请先检查网关与密钥', tried });
  for (const model of candidates) {
    try {
      const result = await completeOnce({ ...config, model }, [{ role: 'user', content: 'hi' }], { maxTokens: 5, temperature: 0, timeout: 20000 });
      return response.json({ working: model, servedAs: result.model, tried });
    } catch (error) {
      tried.push({ model, error: friendlyError(error.message) });
    }
  }
  response.status(502).json({ error: '这些模型当前都无可用通道，稍后再试', tried });
});

const TUTOR_SYSTEM = '你是“奇趣知识岛”的AI老师,面向小学一二年级小朋友。用亲切、简短、鼓励的中文,多用emoji,一次只讲一个重点,讲完提一个小问题引导思考。遇到拼音/汉字/算式要读准确。绝不批评孩子,只鼓励进步。';

// 语音对话 / 文字对话共用:前端把语音转成文字后调这里,拿到回答再用语音播报 = speech to speech
app.post('/api/ai/chat', async (request, response) => {
  const { messages, context, temperature } = request.body;
  if (!Array.isArray(messages) || !messages.length) return response.status(400).json({ error: '缺少对话内容' });
  const profileLine = context?.profileName
    ? `学生:${context.profileName}(${context.grade || '一年级'}),在学:${context.subject || '综合'},近期正确率:${context.accuracy ?? '未知'}。`
    : '';
  const mistakeLine = context?.mistakes?.length
    ? `近期错题:${context.mistakes.slice(0, 5).map((m) => `${m.prompt}=答案${m.answer}(孩子选了${m.picked})`).join('；')}`
    : '';
  try {
    const result = await chatCompletion(resolveLLM(),
      [{ role: 'system', content: `${TUTOR_SYSTEM}${profileLine}${mistakeLine}` },
       ...messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 1000) }))],
      { temperature: Number(temperature) || 0.7, maxTokens: 600 });
    response.json(result);
  } catch (error) {
    response.status(502).json({ error: `AI老师暂时开小差:${error.message}` });
  }
});

// 学情分析:统计确定性计算 + 大模型定性分析,给出掌握情况与学习计划
app.post('/api/ai/analyze', async (request, response) => {
  const { profileId } = request.body;
  if (!validId(profileId)) return response.status(400).json({ error: '缺少档案' });
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
  if (!profile) return response.status(404).json({ error: '档案不存在' });
  const stats = db.prepare(`
    SELECT subject_id AS subjectId, knowledge, COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct
    FROM attempts WHERE profile_id = ? GROUP BY subject_id, knowledge
  `).all(profileId);
  const mistakes = db.prepare('SELECT subject_id AS subjectId, knowledge, prompt, answer, picked, wrong_count AS wrongCount FROM mistakes WHERE profile_id = ? AND mastered = 0 ORDER BY wrong_count DESC LIMIT 10').all(profileId);
  const recent = db.prepare('SELECT subject_id AS subjectId, total, correct, mode, created_at AS createdAt FROM sessions WHERE profile_id = ? ORDER BY created_at DESC LIMIT 5').all(profileId);
  const weakKnowledge = stats.filter((s) => s.total >= 2 && s.correct / s.total < 0.6)
    .sort((a, b) => (a.correct / a.total) - (b.correct / b.total)).slice(0, 5);
  const summary = stats.map((s) => `${s.subjectId}/${s.knowledge}:答${s.total}对${s.correct}`).join('；') || '暂无作答记录';
  // 学段差异：一二年级重习惯、三四年级重方法、五六年级重综合思维
  const g = String(profile.grade || '一年级');
  const stageTip = /五|六/.test(g)
    ? '五六年级重综合思维与方法总结，目标可稍难，讲清思路比刷题重要。'
    : /三|四/.test(g)
      ? '三四年级重学习方法，多教审题、检查与错题归因。'
      : '一二年级重学习习惯与兴趣，多表扬具体进步，少讲大道理。';
  try {
    const { reply, model } = await chatCompletion(resolveLLM(), [
      { role: 'system', content: `${TUTOR_SYSTEM}学段要求:${stageTip}你还要给家长看:分【总评】【闪光点】【薄弱点】【本周3个小目标】【给家长的1条建议】输出,每段2-3句,中文。` },
      { role: 'user', content: `学生${profile.name}(${profile.grade || '一年级'})。学情:${summary}。高频错题:${mistakes.map((m) => `${m.prompt}答案${m.answer}错${m.wrongCount}次`).join('；') || '无'}。最近闯关:${recent.map((r) => `${r.subjectId}${r.correct}/${r.total}`).join('；') || '无'}。请输出学情分析。` },
    ], { maxTokens: 1000 });
    response.json({ analysis: reply, model, weakKnowledge, stats, mistakes, recent });
  } catch (error) {
    // 大模型不可用时仍返回确定性统计,不阻断学习
    response.json({ analysis: '', model: '', weakKnowledge, stats, mistakes, recent, fallback: true, error: error.message });
  }
});

// 按需出题:根据薄弱点 + 记忆曲线 + 核心知识,让大模型出专属题;失败则前端回退本地题库
app.post('/api/ai/questions', async (request, response) => {
  const { profileId, subjectId, count = 5, focus } = request.body;
  if (!subjectId) return response.status(400).json({ error: '缺少学科' });
  const profile = validId(profileId) ? db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) : null;
  const stats = validId(profileId) ? db.prepare('SELECT knowledge, COUNT(*) AS total, COALESCE(SUM(correct),0) AS correct FROM attempts WHERE profile_id = ? AND subject_id = ? GROUP BY knowledge').all(profileId, subjectId) : [];
  const weak = stats.filter((s) => s.total >= 1 && s.correct / s.total < 0.7).map((s) => `${s.knowledge}(对${s.correct}/${s.total})`);
  const focusIds = String(focus || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  if (focusIds.length) weak.unshift(...focusIds.map((id) => `${id}(指定专练)`));
  const mistakes = validId(profileId) ? db.prepare('SELECT prompt, answer, knowledge FROM mistakes WHERE profile_id = ? AND subject_id = ? AND mastered = 0 LIMIT 5').all(profileId, subjectId) : [];
  const catalog = KNOWLEDGE[subjectId] || [];
  const grade = profile?.grade || '一年级';
  const gradeDigit = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6' }[String(grade)[0]] || '';
  // 目录裁剪：薄弱单元 > 同年级单元 > 其他，同级内按ID稳定排序，超长截断（目录全量仍可通过 /api/curriculum 查看）
  const weakIds = new Set(weak.map((w) => String(w).split('(')[0]));
  const rankOf = (k) => (weakIds.has(k.id) ? 0 : (gradeDigit && k.id.includes(`-${gradeDigit}`) ? 1 : 2));
  const catalogText = [...catalog]
    .sort((a, b) => rankOf(a) - rankOf(b) || (a.id < b.id ? -1 : 1))
    .map((k) => `${k.id}:${k.name}(${k.grade},${k.desc})`)
    .join('；')
    .slice(0, 2200);
  const promptText = `你是小学${grade}老师,按人教版考纲出题。学科:${subjectId}。知识点目录:${catalogText}。薄弱点:${weak.join('；') || '暂无,覆盖核心知识'}。错题:${mistakes.map((m) => m.prompt).join('；') || '无'}。${focusIds.length ? `本次必须围绕指定单元出题:${focusIds.join('、')}。` : ''}\n请出${Math.min(10, Math.max(3, Number(count) || 5))}道适合${grade}小朋友的选择题,只输出纯JSON数组,不要markdown:每个元素含 prompt(题干)、visual(emoji辅助)、options(4个选项字符串,第1个必须是正确答案,顺序我会打乱)、answer(必须等于options第1个)、type(题型名)、knowledge(知识点id,用目录里的id)、explain(20-40字儿童讲解)。覆盖薄弱点,难度循序渐进。`;
  try {
    const { reply, model } = await chatCompletion(resolveLLM(),
      [{ role: 'user', content: promptText }], { temperature: 0.8, maxTokens: 2000 });
    const match = reply.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI出题格式异常');
    const raw = JSON.parse(match[0]).map((item) => ({ ...item, answer: item.options?.[0] ?? item.answer }));
    response.json({ questions: raw, model });
  } catch (error) {
    response.status(502).json({ error: `AI出题失败:${error.message},可用本地题库继续闯关` });
  }
});

if (process.env.NODE_ENV === 'production') app.use(express.static(resolve(root, 'dist')));
const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  const llm = resolveLLM();
  console.log(`Kids Quiz API: http://localhost:${port} | LLM: ${llm.baseUrl} / ${llm.model || '未配置模型(请到设置页选择)'}`);
});
