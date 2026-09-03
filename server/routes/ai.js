// 路由：AI 网关配置 + 对话 / 学情分析 / 专属出题 / 模型探测
import { Router } from 'express';
import { db, getSetting, maskKey, setSetting, validId } from '../db.js';
import { chatCompletion, completeOnce, fetchModels, friendlyError, isChatModel, resolveLLM } from '../llm.js';
import { KNOWLEDGE } from '../../src/curriculum.js';

const router = Router();

router.get('/config', (_request, response) => {
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
router.get('/settings', (_request, response) => {
  const { baseUrl, apiKey, model, fallbacks } = resolveLLM();
  response.json({
    baseUrl: getSetting('llm_base_url'),
    model, fallbacks: fallbacks.join(','),
    hasApiKey: Boolean(getSetting('llm_api_key')),
    apiKeyPreview: maskKey(apiKey),
    effectiveBaseUrl: baseUrl,
    customized: Boolean(getSetting('llm_base_url') || getSetting('llm_api_key') || getSetting('llm_model') || getSetting('llm_fallbacks')),
  });
});

router.put('/settings', (request, response) => {
  const { baseUrl, apiKey, model, fallbacks } = request.body || {};
  if (baseUrl !== undefined) setSetting('llm_base_url', String(baseUrl).trim().replace(/\/$/, ''));
  if (apiKey !== undefined && String(apiKey).trim()) setSetting('llm_api_key', String(apiKey).trim());
  if (model !== undefined) setSetting('llm_model', String(model).trim());
  if (fallbacks !== undefined) setSetting('llm_fallbacks', String(fallbacks).split(',').map((s) => s.trim()).filter(Boolean).join(','));
  const saved = resolveLLM();
  response.json({ ok: true, model: saved.model, baseUrl: saved.baseUrl, apiKeyPreview: maskKey(saved.apiKey) });
});

// 恢复默认：清空数据库里的覆盖，回到环境变量 / 内置
router.delete('/settings', (_request, response) => {
  db.prepare("DELETE FROM settings WHERE key IN ('llm_base_url','llm_api_key','llm_model','llm_fallbacks')").run();
  response.json({ ok: true });
});

router.get('/models', async (_request, response) => {
  try {
    const config = resolveLLM();
    response.json({ models: await fetchModels(config), currentModel: config.model });
  } catch (error) {
    response.status(502).json({ error: `模型列表获取失败:${error.message}` });
  }
});

// 一键探测：用网关实时模型列表动态发现当前可用的模型
router.post('/models/probe', async (_request, response) => {
  const config = resolveLLM();
  const tried = [];
  let candidates = [];
  if (config.model) candidates.push(config.model);
  candidates.push(...(config.fallbacks || []));
  try {
    const live = (await fetchModels(config)).filter(isChatModel);
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

// 语音对话 / 文字对话共用：前端把语音转成文字后调这里，拿到回答再用语音播报 = speech to speech
router.post('/ai/chat', async (request, response) => {
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

// 学情分析：统计确定性计算 + 大模型定性分析，给出掌握情况与学习计划
router.post('/ai/analyze', async (request, response) => {
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
    // 大模型不可用时仍返回确定性统计，不阻断学习
    response.json({ analysis: '', model: '', weakKnowledge, stats, mistakes, recent, fallback: true, error: error.message });
  }
});

// 按需出题：根据薄弱点 + 记忆曲线 + 核心知识（可指定单元），让大模型出专属题；失败则前端回退本地题库
router.post('/ai/questions', async (request, response) => {
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
  // 目录裁剪：薄弱单元 > 同年级单元 > 其他，同级内按ID稳定排序，超长截断
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

export default router;
