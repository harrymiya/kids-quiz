// 学习 Agent：模型负责决策，工具负责确定性观察与动作。工具不可执行任意代码。
import { db, jsonValue, validId } from './db.js';
import { chatCompletion, resolveLLM } from './llm.js';
import { KNOWLEDGE } from '../src/curriculum.js';

const TOOL_LIMIT = 4;
const TOOL_NAMES = new Set(['get_learning_state', 'get_mistakes', 'get_due_reviews', 'diagnose_mistakes', 'get_curriculum', 'make_learning_plan', 'create_learning_tool', 'list_learning_tools', 'recommend_video', 'start_practice', 'start_review', 'open_mistakes', 'open_galaxy', 'celebrate']);

const profileOf = (profileId) => validId(profileId)
  ? db.prepare('SELECT id, name, grade FROM profiles WHERE id = ?').get(profileId)
  : null;

const getLearningState = (profileId) => {
  const profile = profileOf(profileId);
  if (!profile) return { error: '档案不存在' };
  const stats = db.prepare(`SELECT subject_id AS subjectId, knowledge, COUNT(*) AS total,
    COALESCE(SUM(correct), 0) AS correct, MAX(answered_at) AS lastAnsweredAt
    FROM attempts WHERE profile_id = ? GROUP BY subject_id, knowledge ORDER BY lastAnsweredAt DESC LIMIT 80`).all(profileId);
  const sessions = db.prepare(`SELECT subject_id AS subjectId, mode, total, correct, level, created_at AS createdAt
    FROM sessions WHERE profile_id = ? ORDER BY created_at DESC LIMIT 10`).all(profileId);
  return { profile, stats, sessions };
};

const getMistakes = (profileId, subjectId) => {
  if (!profileOf(profileId)) return { error: '档案不存在' };
  let sql = 'SELECT subject_id AS subjectId, knowledge, prompt, answer, picked, explain, wrong_count AS wrongCount FROM mistakes WHERE profile_id = ? AND mastered = 0';
  const params = [profileId];
  if (subjectId) { sql += ' AND subject_id = ?'; params.push(String(subjectId)); }
  sql += ' ORDER BY wrong_count DESC, last_wrong_at DESC LIMIT 20';
  return { mistakes: db.prepare(sql).all(...params) };
};

const getDueReviews = (profileId, subjectId) => {
  if (!profileOf(profileId)) return { error: '档案不存在' };
  const params = [profileId];
  let subjectFilter = '';
  if (subjectId) { subjectFilter = ' AND rp.subject_id = ?'; params.push(String(subjectId)); }
  const reviews = db.prepare(`SELECT rp.question_id AS questionId, rp.subject_id AS subjectId, rp.stage,
    rp.wrong_count AS wrongCount, rp.next_review_at AS nextReviewAt, a.knowledge, a.prompt
    FROM review_progress rp LEFT JOIN attempts a ON a.id = (
      SELECT latest.id FROM attempts latest WHERE latest.profile_id = rp.profile_id
      AND latest.question_id = rp.question_id ORDER BY latest.id DESC LIMIT 1)
    WHERE rp.profile_id = ? AND rp.next_review_at <= CURRENT_TIMESTAMP${subjectFilter}
    ORDER BY rp.wrong_count DESC, rp.next_review_at ASC LIMIT 30`).all(...params);
  const dueBySubject = Object.entries(reviews.reduce((counts, row) => {
    counts[row.subjectId] = (counts[row.subjectId] || 0) + 1; return counts;
  }, {})).map(([id, count]) => ({ subjectId: id, count }));
  return { dueBySubject, reviews };
};

const diagnoseMistakes = (profileId, subjectId) => {
  const result = getMistakes(profileId, subjectId);
  if (result.error) return result;
  const patterns = Object.values(result.mistakes.reduce((groups, mistake) => {
    const key = `${mistake.subjectId}:${mistake.knowledge}`;
    const group = groups[key] ||= { subjectId: mistake.subjectId, knowledge: mistake.knowledge, count: 0, repeated: 0, examples: [] };
    group.count += 1; group.repeated += Number(mistake.wrongCount) || 1;
    if (group.examples.length < 3) group.examples.push({ prompt: mistake.prompt, answer: mistake.answer, picked: mistake.picked });
    return groups;
  }, {})).sort((a, b) => b.repeated - a.repeated);
  return { patterns: patterns.slice(0, 10), totalOpen: result.mistakes.length };
};

const getCurriculum = (subjectId, grade) => {
  const subjects = subjectId ? [String(subjectId)] : Object.keys(KNOWLEDGE);
  const gradeText = String(grade || '');
  return { curriculum: subjects.flatMap((sid) => (KNOWLEDGE[sid] || [])
    .filter((item) => !gradeText || String(item.grade).includes(gradeText[0]))
    .slice(0, 40).map((item) => ({ subjectId: sid, ...item }))) };
};

const createTool = (profileId, args) => {
  if (!profileOf(profileId)) return { error: '档案不存在' };
  const name = String(args?.name || '').trim().slice(0, 40);
  const kind = String(args?.kind || 'practice').trim().slice(0, 24);
  const allowedKinds = new Set(['practice', 'flashcards', 'reflection', 'memory', 'plan']);
  if (!name || !allowedKinds.has(kind)) return { error: '学习工具名称或类型无效' };
  const payload = {
    goal: String(args.goal || '').slice(0, 240),
    instructions: String(args.instructions || '').slice(0, 800),
    items: Array.isArray(args.items) ? args.items.slice(0, 20).map((item) => ({
      prompt: String(item.prompt || '').slice(0, 300), answer: String(item.answer || '').slice(0, 200),
      hint: String(item.hint || '').slice(0, 240),
    })) : [],
  };
  const result = db.prepare('INSERT INTO learning_tools (profile_id, name, kind, payload) VALUES (?, ?, ?, ?)')
    .run(profileId, name, kind, JSON.stringify(payload));
  return { id: Number(result.lastInsertRowid), name, kind, itemCount: payload.items.length };
};

const runTool = (name, args, context) => {
  if (!TOOL_NAMES.has(name)) return { error: '工具不在允许列表中' };
  if (name === 'get_learning_state') return getLearningState(context.profileId);
  if (name === 'get_mistakes') return getMistakes(context.profileId, args?.subjectId);
  if (name === 'get_due_reviews') return getDueReviews(context.profileId, args?.subjectId);
  if (name === 'diagnose_mistakes') return diagnoseMistakes(context.profileId, args?.subjectId);
  if (name === 'get_curriculum') return getCurriculum(args?.subjectId, context.grade);
  if (name === 'create_learning_tool') return createTool(context.profileId, args);
  if (name === 'list_learning_tools') {
    return { tools: db.prepare('SELECT id, name, kind, payload, created_at AS createdAt FROM learning_tools WHERE profile_id = ? ORDER BY updated_at DESC LIMIT 30')
      .all(context.profileId).map((tool) => ({ ...tool, payload: jsonValue(tool.payload, {}) })) };
  }
  if (name === 'make_learning_plan') {
    const state = getLearningState(context.profileId);
    const mistakes = getMistakes(context.profileId).mistakes || [];
    return { profile: state.profile, weak: (state.stats || []).filter((row) => row.total >= 2 && row.correct / row.total < 0.6).slice(0, 8), mistakes: mistakes.slice(0, 8), requestedDays: Math.min(7, Math.max(1, Number(args?.days) || 5)) };
  }
  if (name === 'recommend_video') {
    const topic = String(args?.topic || '').trim().slice(0, 80);
    return topic ? { topic, url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(`小学${context.grade || ''} ${topic} 讲解`)}` } : { error: '缺少主题' };
  }
  if (name === 'start_practice') {
    const subjectId = String(args?.subjectId || 'math');
    if (!KNOWLEDGE[subjectId]) return { error: '学科无效' };
    const focus = String(args?.focus || '').slice(0, 80);
    const count = Math.min(10, Math.max(3, Number(args?.count) || 5));
    return { action: { type: 'start_practice', subjectId, focus, count } };
  }
  if (name === 'start_review') {
    const subjectId = String(args?.subjectId || 'math');
    if (!KNOWLEDGE[subjectId]) return { error: '学科无效' };
    return { action: { type: 'start_review', subjectId, count: Math.min(10, Math.max(3, Number(args?.count) || 5)) } };
  }
  if (name === 'open_mistakes') return { action: { type: 'open_mistakes' } };
  if (name === 'open_galaxy') return { action: { type: 'open_galaxy' } };
  if (name === 'celebrate') return { action: { type: 'celebrate', message: String(args?.message || '为你的认真思考喝彩！').slice(0, 80) } };
  return { error: '工具未实现' };
};

const directIntent = (text, context) => {
  const content = String(text || '');
  if (/打开|进入|看看/.test(content) && /错题本/.test(content)) {
    return { reply: '错题本已经打开啦，我们从最需要巩固的地方开始。', model: 'tool-router', steps: [{ tool: 'open_mistakes', ok: true, summary: 'open_mistakes 执行完成' }], actions: [{ type: 'open_mistakes' }] };
  }
  if (/打开|进入|看看/.test(content) && /知识星图|星图/.test(content)) {
    return { reply: '知识星图已经打开啦，看看哪些星星正在等你点亮。', model: 'tool-router', steps: [{ tool: 'open_galaxy', ok: true, summary: 'open_galaxy 执行完成' }], actions: [{ type: 'open_galaxy' }] };
  }
  if (/到期复习|开始.{0,4}复习/.test(content)) {
    const due = getDueReviews(context.profileId, context.subjectId);
    const target = context.subjectId && due.reviews?.some((row) => row.subjectId === context.subjectId)
      ? context.subjectId
      : due.dueBySubject?.sort((a, b) => b.count - a.count)[0]?.subjectId;
    const steps = [{ tool: 'get_due_reviews', ok: !due.error, summary: due.error || 'get_due_reviews 执行完成' }];
    if (!target) return { reply: '今天暂时没有到期题，记忆状态很好！可以做一组新的挑战。', model: 'tool-router', steps, actions: [] };
    steps.push({ tool: 'start_review', ok: true, summary: 'start_review 执行完成' });
    return { reply: `已准备好${target}的到期复习，我们用几道题把记忆加固。`, model: 'tool-router', steps, actions: [{ type: 'start_review', subjectId: target, count: 5 }] };
  }
  return null;
};

const AGENT_SYSTEM = `你是奇趣知识岛的学习 Agent，目标是提升孩子的理解、迁移、记忆和学习习惯。
你拥有受控工具。每次回复必须只输出一个 JSON 对象，不要 markdown：
{"message":"给孩子看的简短中文回复","tool":{"name":"工具名","args":{}}}
如果不需要工具，tool 必须为 null。先观察学情再给建议；遇到错题先诊断原因，再给一个适量练习；不要一次塞太多内容。
可用工具：get_learning_state(读取作答与闯关)、get_mistakes(读取未掌握错题，可传subjectId)、get_due_reviews(读取到期记忆复习，可传subjectId)、diagnose_mistakes(聚合错因模式，可传subjectId)、get_curriculum(读取目录，可传subjectId)、make_learning_plan(根据真实数据整理计划，可传days)、create_learning_tool(创建学习工具，args含name/kind/goal/instructions/items，kind只能是practice/flashcards/reflection/memory/plan)、list_learning_tools(读取已创建工具)、recommend_video(推荐一个主题视频)、start_practice(启动专练，传subjectId/focus/count)、start_review(启动到期复习，传subjectId/count)、open_mistakes(打开错题本)、open_galaxy(打开知识星图)、celebrate(为真实努力触发庆祝，可传message)。
绝不执行代码、SQL、系统命令；不索要密钥、住址等隐私；不羞辱孩子。工具结果只用于本次教学。发起 start_practice、start_review、open_mistakes 或 open_galaxy 后，下一轮必须停止调用工具并给出简短说明。`;

const parseDecision = (reply) => {
  const match = String(reply || '').match(/\{[\s\S]*\}/);
  if (!match) return { message: String(reply || '').trim(), tool: null };
  try {
    const parsed = JSON.parse(match[0]);
    return { message: String(parsed.message || '').trim(), tool: parsed.tool && typeof parsed.tool === 'object' ? parsed.tool : null };
  } catch { return { message: String(reply || '').trim(), tool: null }; }
};

export async function runLearningAgent({ profileId, messages, context = {} }) {
  const agentContext = { profileId, grade: context.grade || profileOf(profileId)?.grade || '一年级', subjectId: KNOWLEDGE[context.subjectId] ? context.subjectId : '' };
  const lastMessage = Array.isArray(messages) ? messages.at(-1)?.content : '';
  const direct = directIntent(lastMessage, agentContext);
  if (direct) return direct;
  const transcript = Array.isArray(messages) ? messages.slice(-8).map((item) => ({
    role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content || '').slice(0, 1000),
  })) : [];
  const steps = [];
  const actions = [];
  let model = '';
  for (let i = 0; i < TOOL_LIMIT; i += 1) {
    const result = await chatCompletion(resolveLLM(), [
      { role: 'system', content: AGENT_SYSTEM },
      { role: 'system', content: `当前档案上下文:${JSON.stringify(agentContext)}。` },
      ...transcript,
    ], { temperature: 0.35, maxTokens: 900 });
    model = result.model;
    const decision = parseDecision(result.reply);
    if (!decision.tool?.name) return { reply: decision.message || result.reply, model, steps, actions };
    const toolName = String(decision.tool.name);
    const toolResult = runTool(toolName, decision.tool.args || {}, agentContext);
    steps.push({ tool: toolName, ok: !toolResult.error, summary: toolResult.error || `${toolName} 执行完成` });
    if (toolResult.action) {
      actions.push(toolResult.action);
      return { reply: decision.message || '已经为你准备好下一步学习任务。', model, steps, actions };
    }
    transcript.push({ role: 'assistant', content: JSON.stringify({ message: decision.message, tool: decision.tool }) });
    transcript.push({ role: 'user', content: `工具 ${toolName} 返回:${JSON.stringify(toolResult).slice(0, 6000)}。请根据结果继续决策或给最终回答。` });
  }
  const final = await chatCompletion(resolveLLM(), [
    { role: 'system', content: `${AGENT_SYSTEM}现在请停止调用工具，只根据动作结果给出最终回复，tool必须为null。` },
    ...transcript.slice(-10),
  ], { temperature: 0.4, maxTokens: 700 });
  return { reply: parseDecision(final.reply).message || final.reply, model: final.model, steps, actions };
}
