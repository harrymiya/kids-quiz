import { useEffect, useMemo, useState } from 'react';
import { audio } from './audio';
import Fireworks from './Fireworks';
import { api } from './api';
import { stopSpeak } from './voice';
import {
  buildMistakeQuestions, buildQuestions, difficulties, knowledgeName, BANKS_COUNT,
  normalizeAIQuestions, subjects,
} from './questions';
import Setup from './components/Setup';
import GameView from './components/GameView';
import Result from './components/Result';
import MistakesView from './components/MistakesView';
import ReportView from './components/ReportView';
import TutorView from './components/TutorView';
import GalaxyView from './components/GalaxyView';
import SettingsView from './components/SettingsView';
import { addAchv, subjectOf } from './components/bits';

const encouragement = ['加油哦！', '想好啦？', '你最棒啦！'];
const praise = ['哇！厉害！', '你真聪明！', '好棒呀！', '又答对啦！'];


function App() {
  const [screen, setScreen] = useState('start');
  const [subject, setSubject] = useState(subjects[0]);
  const [difficulty, setDifficulty] = useState(1);
  const [questionCount, setQuestionCount] = useState(5);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [memoryDue, setMemoryDue] = useState([]);
  const [weakMap, setWeakMap] = useState({});
  const [mastery, setMastery] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [analysis, setAnalysis] = useState('');
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState('');
  // 游戏态
  const [level, setLevel] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [gameMode, setGameMode] = useState('闯关');
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [stars, setStars] = useState(0);
  const [message, setMessage] = useState('');
  const [answerState, setAnswerState] = useState(null);
  const [selectedRelic, setSelectedRelic] = useState(null);
  const [activeRelics, setActiveRelics] = useState([]);
  const [relicUses, setRelicUses] = useState({});
  const [passiveState, setPassiveState] = useState({});
  const [hiddenOptions, setHiddenOptions] = useState([]);
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [armedEffects, setArmedEffects] = useState({});
  const [fireworks, setFireworks] = useState(false);
  const [muted, setMuted] = useState(false);
  const [runDetails, setRunDetails] = useState([]);
  const [runWrongs, setRunWrongs] = useState([]);
  // AI 老师
  const [tutorMsgs, setTutorMsgs] = useState([{ role: 'assistant', content: '你好呀，我是岛上的AI老师威威！可以文字聊，也可以点话筒跟我语音说话哦。想先从哪一科学起？' }]);
  const [pendingAsk, setPendingAsk] = useState(null);
  const [activity, setActivity] = useState({ streakDays: 0, totalDays: 0 });
  const [wrongStreak, setWrongStreak] = useState(0);
  const [lastRate, setLastRate] = useState(0);
  const [nextPlanBusy, setNextPlanBusy] = useState(false);
  const [intervention, setIntervention] = useState({ mode: 'standard', label: '独立思考', message: '' });
  const q = questions[index];

  const refreshProfiles = () =>
    api.profiles().then((data) => { setProfiles(data); setProfile((p) => p ? data.find((d) => d.id === p.id) || data[0] : data[0]); }).catch(() => {});
  useEffect(() => { refreshProfiles(); }, []);
  useEffect(() => {
    if (!profile) return;
    api.dueReviews(profile.id, subject.id).then(setMemoryDue).catch(() => setMemoryDue([]));
    api.activity(profile.id).then(setActivity).catch(() => {});
    api.mastery(profile.id).then((data) => {
      setMastery(data);
      const map = {};
      data.knowledge.forEach((row) => {
        if (row.total >= 2 && row.correct / row.total < 0.6) {
          (map[row.subjectId] ||= []).push(row.knowledge);
        }
      });
      setWeakMap(map);
    }).catch(() => {});
  }, [profile?.id, subject.id]);
  useEffect(() => {
    if (!profile || (screen !== 'mistakes' && screen !== 'report' && screen !== 'tutor' && screen !== 'galaxy')) return;
    api.mistakes(profile.id).then(setMistakes).catch(() => {});
    if (screen === 'report') api.sessions(profile.id).then(setSessions).catch(() => {});
  }, [screen, profile?.id]);

  useEffect(() => {
    if (!profile || !q || answerState) return undefined;
    let active = true;
    setIntervention({ mode: 'standard', label: '独立思考', message: '' });
    api.intervention({ profileId: profile.id, subjectId: subject.id, knowledge: q.knowledge || '综合', streak, wrongStreak, lives })
      .then((data) => {
        if (!active) return;
        setIntervention(data);
        if (data.message) setMessage(data.message);
        if (data.autoEliminate) {
          const candidate = q.options.find((option) => String(option) !== String(q.answer));
          if (candidate) setHiddenOptions([candidate]);
        }
      }).catch(() => {});
    return () => { active = false; };
  }, [profile?.id, q?.id, subject.id, answerState, streak, wrongStreak, lives]);

  const title = useMemo(() => difficulties.find((item) => item.value === difficulty)?.name || '热身', [difficulty]);
  const go = (next) => { audio.init(); setFireworks(false); stopSpeak(); setScreen(next); };
  const flash = (text) => { setNotice(text); window.clearTimeout(flash.t); flash.t = window.setTimeout(() => setNotice(''), 3200); };

  const resetRun = (list, mode) => {
    setQuestions(list); setGameMode(mode); setIndex(0); setCorrect(0); setLives(3);
    setStreak(0); setBestStreak(0); setStars(0); setRunDetails([]); setRunWrongs([]);
    setPassiveState({}); setHiddenOptions([]); setRevealedAnswer(false); setArmedEffects({});
    setMessage(encouragement[Math.floor(Math.random() * encouragement.length)]);
    setAnswerState(null); setScreen('game'); audio.prompt();
  };
  const startLevel = (runLevel, { newAdventure = false, nextLives = lives } = {}, diff = difficulty, subj = subject) => {
    audio.init(); audio.click();
    const created = buildQuestions(subj.id, runLevel + diff - 1, questionCount,
      memoryDue.map((item) => item.questionId), { weakKnowledge: weakMap[subj.id] || [] });
    setSubject(subj); setDifficulty(diff); setWrongStreak(0);
    if (newAdventure) { setLevel(1); setActiveRelics([]); setRelicUses({}); setBestStreak(0); setStars(0); resetRun(created, '闯关'); setLives(3); return; }
    setQuestions(created); setIndex(0); setCorrect(0); setLives(nextLives); setStreak(0);
    setPassiveState({}); setHiddenOptions([]); setRevealedAnswer(false); setArmedEffects({});
    setRunDetails([]); setRunWrongs([]);
    setMessage(encouragement[Math.floor(Math.random() * encouragement.length)]); setAnswerState(null); setScreen('game'); audio.prompt();
  };
  // 开新局（可指定学科与难度，供学习计划 / 难度建议调用）
  const startNormalQuiz = (subj = subject, diff = difficulty) => { setLevel(1); setActiveRelics([]); startLevel(1, { newAdventure: true, nextLives: 3 }, diff, subj); };
  const newRun = () => startNormalQuiz(subject, difficulty);

  const startAIQuiz = async (subjectId, count, focus) => {
    if (!profile) return;
    setAiBusy(true);
    try {
      const data = await api.aiQuestions(profile.id, subjectId, count, focus);
      const list = normalizeAIQuestions(subjectId, data.questions);
      if (!list.length) throw new Error('AI题目为空');
      setSubject(subjectOf(subjectId)); setLevel(1); setActiveRelics([]); setRelicUses({});
      setBestStreak(0); setStars(0); resetRun(list, 'AI专属');
      flash(`AI老师出了 ${list.length} 道专属题！`);
    } catch (e) {
      // 失败回退本地自适应题库,不阻断学习
      const fallback = buildQuestions(subjectId, difficulty + 1, count, [], { weakKnowledge: weakMap[subjectId] || [] });
      setSubject(subjectOf(subjectId)); setLevel(1); setActiveRelics([]); setRelicUses({});
      setBestStreak(0); setStars(0); resetRun(fallback, '闯关');
      flash(`${e.message}，已用本地题库继续`);
    } finally { setAiBusy(false); }
  };

  const startReview = async (subjectId, count = 5) => {
    if (!profile) return;
    setAiBusy(true);
    try {
      const due = await api.dueReviews(profile.id, subjectId);
      const list = due.slice(0, count).filter((item) => item.prompt && String(item.answer || '').length && Array.isArray(item.options) && item.options.length >= 2).map((item) => ({
        id: item.questionId, prompt: item.prompt, visual: item.visual || '🧠', answer: item.answer,
        options: item.options,
        type: '到期复习', knowledge: item.knowledge || '综合', explain: item.explain || '回忆一下我们学过的方法吧！',
      }));
      if (!list.length) {
        flash('暂时没有到期复习题，先做一组巩固练习吧！');
        await startAIQuiz(subjectId, count);
        return;
      }
      setSubject(subjectOf(subjectId)); setLevel(1); setActiveRelics([]); setRelicUses({});
      setBestStreak(0); setStars(0); resetRun(list, '记忆复习');
      flash(`今天有 ${list.length} 道到期复习题！`);
    } catch (e) { flash(`复习题加载失败：${e.message}`); }
    finally { setAiBusy(false); }
  };

  const startMistakeQuiz = (pool) => {
    const open = (pool || mistakes).filter((m) => !m.mastered);
    if (!open.length) { flash('错题本空空的，太棒了！'); return; }
    const list = buildMistakeQuestions(open, Math.min(10, open.length));
    if (open[0]?.subject_id) setSubject(subjectOf(open[0].subject_id));
    setLevel(1); setActiveRelics([]); setRelicUses({}); setBestStreak(0); setStars(0);
    resetRun(list, '错题重练');
  };

  // 单元专练：AI 围绕指定单元出题
  const practiceUnit = (subjectId, unitId) => startAIQuiz(subjectId, 5, unitId);
  const handleAgentAction = (action) => {
    if (action?.type === 'start_practice') startAIQuiz(action.subjectId, action.count, action.focus);
    if (action?.type === 'start_review') startReview(action.subjectId, action.count);
    if (action?.type === 'open_mistakes') go('mistakes');
    if (action?.type === 'open_galaxy') go('galaxy');
    if (action?.type === 'celebrate') {
      setFireworks(true); flash(action.message || '为你的认真思考喝彩！');
      window.setTimeout(() => setFireworks(false), 3200);
    }
  };

  const hasRelic = (id) => activeRelics.some((item) => item.id === id);
  const useRelic = (relic) => {
    if (answerState || relic.type !== 'active' || (relicUses[relic.id] || 0) <= 0) return;
    let used = true; let nextMessage = '';
    if (relic.id === 'life-potion') {
      if (lives >= 4) used = false;
      else { setLives((value) => Math.min(4, value + 1)); nextMessage = '生命果汁生效，恢复了 1 点生命！'; }
    }
    if (relic.id === 'hint-lens') {
      const candidates = q.options.filter((option) => String(option) !== String(q.answer) && !hiddenOptions.some((hidden) => String(hidden) === String(option)));
      if (!candidates.length) used = false;
      else { setHiddenOptions((items) => [...items, candidates[Math.floor(Math.random() * candidates.length)]]); nextMessage = '望远镜帮你排除了一个错误答案！'; }
    }
    if (relic.id === 'answer-crystal') {
      if (revealedAnswer) used = false;
      else { setRevealedAnswer(true); nextMessage = '答案水晶亮起来啦，留意发光的选项！'; }
    }
    if (relic.id === 'star-cookie') { setStars((value) => value + 2); nextMessage = '咔嚓！收下 2 颗香甜的星星！'; }
    if (relic.id === 'double-badge') {
      if (armedEffects.double) used = false;
      else { setArmedEffects((state) => ({ ...state, double: true })); nextMessage = '双倍徽章已准备，下次答对会多得 1 星！'; }
    }
    if (relic.id === 'guard-bubble') {
      if (armedEffects.guard) used = false;
      else { setArmedEffects((state) => ({ ...state, guard: true })); nextMessage = '守护泡泡已罩好，下次答错不会扣生命！'; }
    }
    if (!used) return;
    setRelicUses((state) => ({ ...state, [relic.id]: state[relic.id] - 1 }));
    setMessage(nextMessage); audio.click();
  };

  const answer = (value) => {
    if (answerState || !q) return;
    const isCorrect = String(value) === String(q.answer);
    const nextStreak = isCorrect ? streak + 1 : 0;
    let nextLives = lives;
    let earnedStars = isCorrect ? 1 : 0;
    const triggered = [];
    if (isCorrect) {
      if (armedEffects.double) { earnedStars += 1; triggered.push('双倍徽章'); setArmedEffects((state) => ({ ...state, double: false })); }
      if (hasRelic('light-feather') && nextStreak % 2 === 0) { earnedStars += 1; triggered.push('轻盈羽毛'); }
      if (hasRelic('wisdom-crown') && !passiveState.crownUsed) { earnedStars += 1; triggered.push('智慧王冠'); setPassiveState((state) => ({ ...state, crownUsed: true })); }
      if (hasRelic('trail-map') && index === questions.length - 1) { earnedStars += 2; triggered.push('探险地图'); }
      if (hasRelic('streak-drum') && nextStreak % 3 === 0) { earnedStars += 1; triggered.push('连击小鼓'); }
      if (hasRelic('brave-heart') && lives === 1) { earnedStars += 1; triggered.push('勇敢之心'); }
      setAnswerState({ value, isCorrect: true, earnedStars });
      setCorrect((n) => n + 1); setStars((n) => n + earnedStars); setStreak(nextStreak); setBestStreak((n) => Math.max(n, nextStreak));
      setWrongStreak(0);
      // Agent 动态调节：3 连对状态火热，额外奖 1 星
      if (nextStreak === 3) { setStars((n) => n + 1); setMessage('🔥 3 连击！状态火热，再奖 1 星～'); }
      else setMessage(triggered.length ? `${triggered.join('、')}触发！这题获得 ${earnedStars} 颗星！` : praise[Math.floor(Math.random() * praise.length)]);
      if (navigator.vibrate) navigator.vibrate([35, 25, 55]);
      audio.correct();
    } else {
      const bubbleProtected = Boolean(armedEffects.guard);
      const cloverProtected = hasRelic('lucky-clover') && !passiveState.cloverUsed;
      const protectedLife = bubbleProtected || cloverProtected;
      if (bubbleProtected) { setArmedEffects((state) => ({ ...state, guard: false })); triggered.push('守护泡泡'); }
      else if (cloverProtected) { setPassiveState((state) => ({ ...state, cloverUsed: true })); triggered.push('幸运四叶草'); }
      if (!protectedLife) { nextLives = lives - 1; setLives(nextLives); }
      setStreak(0);
      setAnswerState({ value, isCorrect: false });
      // Agent 动态调节：连错 2 次，威威自动排除一个错误选项扶一把
      const nextWrong = wrongStreak + 1;
      setWrongStreak(nextWrong);
      const helpCandidate = q.options.find((option) => String(option) !== String(q.answer) && !hiddenOptions.some((hidden) => String(hidden) === String(option)));
      if (nextWrong >= 2 && helpCandidate && !protectedLife) {
        setHiddenOptions((items) => [...items, helpCandidate]);
        setMessage('威威帮你排除了一个错误选项，慢慢想，你可以的！');
      } else setMessage(protectedLife ? `${triggered[0]}保护了你，没有扣生命！` : (nextLives > 0 ? '别灰心，看看小老师的讲解！' : '生命用完了，回到营地休息一下吧！'));
      audio.wrong();
      setRunWrongs((items) => [...items, { ...q, picked: value }]);
    }
    setRunDetails((items) => [...items, { id: q.id, k: q.knowledge || '综合', ok: isCorrect }]);
    // 跟踪记录:作答 + 知识点 + 快照(错题本自动归集在后端完成)
    if (profile) {
      api.saveAttempt({
        profileId: profile.id, questionId: q.id, subjectId: q.aiMade ? subject.id : (mistakes.find((m) => m.question_id === q.id)?.subject_id || subject.id),
        correct: isCorrect, knowledge: knowledgeName(subject.id, q.knowledge) !== '综合' ? q.knowledge : (q.knowledge || '综合'),
        picked: value, answer: q.answer, prompt: q.prompt, visual: q.visual, options: q.options, explain: q.explain || '', intervention: intervention.mode,
      }).catch(() => {});
    }
    const nextCorrect = isCorrect ? correct + 1 : correct;
    window.setTimeout(() => {
      if (nextLives <= 0 || index + 1 >= questions.length) finish(nextCorrect, nextLives);
      else { setIndex((n) => n + 1); setAnswerState(null); setHiddenOptions([]); setRevealedAnswer(false); setMessage(encouragement[Math.floor(Math.random() * encouragement.length)]); }
    }, isCorrect ? 850 : 2200);
  };

  const finish = (score, remainingLives) => {
    const passed = remainingLives > 0 && score >= Math.ceil(questions.length * 0.6);
    const rate = questions.length ? score / questions.length : 0;
    setLastRate(rate);
    setCorrect(score); setAnswerState(null);
    if (rate === 1 && questions.length >= 3) { addAchv('perfect'); flash('🏆 满分学霸！已记入成就'); }
    setMessage(passed ? '选择一个增益，继续深入知识岛。' : '带着经验回到营地，下一次一定走得更远。');
    setSelectedRelic(null); setFireworks(passed); audio[passed ? 'fanfare' : 'sad'](); setScreen('result');
    if (profile) {
      api.saveSession({
        profileId: profile.id, subjectId: subject.id, mode: gameMode,
        total: questions.length, correct: score, level, detail: runDetails,
      }).catch(() => {});
    }
  };
  const continueRun = () => {
    setFireworks(false);
    const passed = lives > 0 && correct >= Math.ceil(questions.length * 0.6);
    if (!passed || level >= 5) { newRun(); return; }
    if (selectedRelic) {
      setActiveRelics((items) => [...items, selectedRelic]);
      if (selectedRelic.type === 'active') setRelicUses((state) => ({ ...state, [selectedRelic.id]: selectedRelic.uses }));
    }
    const nextLevel = level + 1;
    // Agent 动态调节：本局正确率 ≥85% 且闯关成功，自动升一档难度
    let nextDiff = difficulty;
    const levels = difficulties.map((d) => d.value);
    if (passed && lastRate >= 0.85 && difficulty < 5) {
      nextDiff = levels[Math.min(levels.length - 1, levels.indexOf(difficulty) + 1)];
      flash(`状态火热🔥难度自动升到「${difficulties.find((d) => d.value === nextDiff)?.name}」！`);
    }
    setLevel(nextLevel); startLevel(nextLevel, { nextLives: Math.min(4, lives) }, nextDiff);
  };

  const askAgentNext = async () => {
    if (!profile || nextPlanBusy) return;
    setNextPlanBusy(true);
    try {
      const detail = runDetails.slice(-10).map((item) => `${item.k}:${item.ok ? '对' : '错'}`).join('、');
      const data = await api.aiAgent(profile.id, [{ role: 'user', content: `我刚完成${gameMode}，正确率${Math.round(lastRate * 100)}%，本局记录：${detail}。请复盘并安排最合适的下一步学习任务。` }], { grade: profile.grade, subject: subject.name, subjectId: subject.id });
      setTutorMsgs((list) => [...list, { role: 'user', content: '请帮我安排下一步学习' }, { role: 'assistant', content: data.reply, steps: data.steps, model: data.model }]);
      (data.actions || []).forEach((action) => handleAgentAction(action));
      if (!(data.actions || []).length) go('tutor');
    } catch (e) { flash(`AI安排失败：${e.message}`); }
    finally { setNextPlanBusy(false); }
  };

  const askAbout = (question) => { setPendingAsk(question); go('tutor'); };

  const runAnalyze = async () => {
    if (!profile) return;
    setAiBusy(true);
    try {
      const data = await api.aiAnalyze(profile.id);
      const map = {};
      (data.weakKnowledge || []).forEach((row) => { (map[row.subjectId] ||= []).push(row.knowledge); });
      if (Object.keys(map).length) setWeakMap((prev) => ({ ...prev, ...map }));
      setAnalysis(data.analysis || '');
      setAnalysisMeta(data);
      if (data.fallback) flash(data.error ? `AI分析暂不可用，已展示本地统计：${data.error}` : 'AI分析暂不可用，已展示本地统计');
    } catch (e) { flash(e.message); } finally { setAiBusy(false); }
  };

  // Agent 难度建议：学完本局，按正确率建议下局升/降档
  const levelValues = difficulties.map((d) => d.value);
  const suggestion = gameMode === '闯关' && questions.length && lastRate > 0
    ? (lastRate >= 0.85 && difficulty < 5
      ? { label: '升一档', diff: levelValues[levelValues.indexOf(difficulty) + 1] }
      : (lastRate < 0.6 && difficulty > 1
        ? { label: '降一档', diff: levelValues[levelValues.indexOf(difficulty) - 1] } : null))
    : null;

  const nav = [
    ['start', '🏠', '闯关'], ['galaxy', '🗺️', '星图'], ['mistakes', '📕', '错题本'], ['report', '🤖', 'AI学情'], ['tutor', '🎙️', 'AI老师'], ['settings', '⚙️', '设置'],
  ];
  const openMistakes = mistakes.filter((m) => !m.mastered).length;

  return <>
    <div className="sky-decor" aria-hidden="true"><span className="cloud cloud-a">☁</span><span className="cloud cloud-b">☁</span><span className="float-icon icon-a">✦</span><span className="float-icon icon-b">✿</span><span className="float-icon icon-c">★</span><span className="float-icon icon-d">✦</span></div>
    <header className="global-header">
      <button className="brand" onClick={() => go('start')} aria-label="返回首页"><span className="brand-mark">🐾</span><span>奇趣知识岛</span></button>
      <nav className="top-nav">{nav.map(([id, icon, label]) => (
        <button key={id} className={`nav-btn ${screen === id || (id === 'start' && ['setup', 'game', 'result'].includes(screen)) ? 'selected' : ''}`} onClick={() => go(id)}>
          {icon}<small>{label}</small>{id === 'mistakes' && openMistakes > 0 && <i className="nav-badge">{openMistakes > 99 ? '99+' : openMistakes}</i>}
        </button>))}
      </nav>
      <button className="round-control" onClick={() => { const next = !muted; setMuted(next); audio.muted = next; }} aria-label="声音开关">{muted ? '🔇' : '🔊'}</button>
    </header>
    {notice && <div className="toast" role="status">{notice}</div>}
    {screen === 'start' && <section className="screen active"><div className="hero"><div className="hero-copy"><div className="eyebrow"><span>NEW</span> AI老师 + 语音对话 + 错题本</div><h1>登上知识岛<br /><em>玩着学，更聪明！</em></h1><p>人教版一二年级考纲全覆盖：数学计算、拼音识字、英语启蒙、科学与生活常识。AI跟踪每次作答，专属推题、语音陪练、错题归集。</p><div className="hero-actions"><button className="primary-btn" onClick={() => go('setup')}>开始探险 <span>➜</span></button><div className="mini-proof"><b>{BANKS_COUNT}+</b><span>考纲精题 + AI无限出题</span></div><div className="mini-proof"><b>🔥{activity.streakDays}天</b><span>连续学习打卡</span></div></div><div className="feature-row"><div><span className="feature-icon mint">🎙️</span><p><b>语音对话</b><small>开口说话，AI老师陪练</small></p></div><div><span className="feature-icon yellow">📕</span><p><b>错题本</b><small>自动归集，练到掌握</small></p></div><div><span className="feature-icon pink">🤖</span><p><b>智能教学</b><small>学情分析 + 记忆曲线</small></p></div></div></div><div className="island-scene"><div className="sun">☀</div><div className="orbit orbit-1">🎯</div><div className="orbit orbit-2">🧩</div><div className="orbit orbit-3">🎵</div><div className="mascot-card"><div className="mascot">🐶</div><div className="mascot-name">AI老师 · 威威</div></div><div className="island-base"><span>🌳</span><span>🏫</span><span>🌳</span></div></div></div></section>}
    {screen === 'setup' && <Setup subject={subject} setSubject={setSubject} difficulty={difficulty} setDifficulty={setDifficulty} questionCount={questionCount} setQuestionCount={setQuestionCount} profiles={profiles} profile={profile} setProfile={setProfile} refreshProfiles={refreshProfiles} title={title} memoryDue={memoryDue} weakMap={weakMap} aiBusy={aiBusy} onBack={() => go('start')} onStart={newRun} onAIStart={startAIQuiz} />}
    {screen === 'game' && q && <GameView q={q} index={index} questionCount={questions.length} level={level} gameMode={gameMode} subject={subject} profileGrade={profile?.grade} lives={lives} streak={streak} stars={stars} answerState={answerState} message={message} intervention={intervention} activeRelics={activeRelics} relicUses={relicUses} passiveState={passiveState} armedEffects={armedEffects} hiddenOptions={hiddenOptions} revealedAnswer={revealedAnswer} onUseRelic={useRelic} onAnswer={answer} onBack={() => go('setup')} onRead={() => audio.speak(`${q.prompt}，${q.visual}，请选择正确答案`)} onReadExplain={() => audio.speak(q.explain || '再想一想吧')} onAskAI={() => askAbout({ ...q, picked: answerState?.value })} />}
    {screen === 'result' && <Result correct={correct} count={questions.length} level={level} lives={lives} bestStreak={bestStreak} passed={lives > 0 && correct >= Math.ceil(questions.length * 0.6)} selectedRelic={selectedRelic} setSelectedRelic={setSelectedRelic} activeRelics={activeRelics} runWrongs={runWrongs} gameMode={gameMode} suggestion={suggestion} onSuggestion={(diff) => startNormalQuiz(subject, diff)} onContinue={continueRun} onChange={() => go('setup')} onMistakes={() => go('mistakes')} onReport={() => go('report')} onRead={(t) => audio.speak(t)} onAgentNext={askAgentNext} nextPlanBusy={nextPlanBusy} />}
    {screen === 'mistakes' && <MistakesView mistakes={mistakes} profile={profile} onPractice={startMistakeQuiz} onMastered={async (id, v) => { await api.markMastered(id, v); setMistakes((list) => list.map((m) => (m.id === id ? { ...m, mastered: v ? 1 : 0 } : m))); }} onRead={(t) => audio.speak(t)} />}
    {screen === 'report' && <ReportView profile={profile} mastery={mastery} sessions={sessions} mistakes={mistakes} analysis={analysis} analysisMeta={analysisMeta} aiBusy={aiBusy} weakMap={weakMap} onAnalyze={runAnalyze} onAIQuiz={startAIQuiz} onPracticeUnit={practiceUnit} onMistakePractice={() => startMistakeQuiz()} onNormalPractice={(sid) => startNormalQuiz(subjectOf(sid), difficulty)} onRead={(t) => audio.speak(t)} />}
    {screen === 'tutor' && <TutorView profile={profile} subject={subject} profiles={profiles} mistakes={mistakes} msgs={tutorMsgs} setMsgs={setTutorMsgs} pendingAsk={pendingAsk} clearPendingAsk={() => setPendingAsk(null)} flash={flash} onAgentAction={handleAgentAction} />}
    {screen === 'galaxy' && <GalaxyView profile={profile} mastery={mastery} aiBusy={aiBusy} onPracticeUnit={practiceUnit} />}
    {screen === 'settings' && <SettingsView profile={profile} setProfile={setProfile} refreshProfiles={refreshProfiles} flash={flash} />}
    <Fireworks active={fireworks} />
  </>;
}

export default App;
