import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from './audio';
import Fireworks from './Fireworks';
import { api } from './api';
import { listenOnce, speak, speechSupported, stopSpeak, ttsSupported } from './voice';
import {
  GRADES, KNOWLEDGE, buildMistakeQuestions, buildQuestions, difficulties, isUnitId,
  knowledgeName, normalizeAIQuestions, relics, shuffle, subjects, unitGrade,
} from './questions';

const encouragement = ['加油哦！', '想好啦？', '你最棒啦！'];
const praise = ['哇！厉害！', '你真聪明！', '好棒呀！', '又答对啦！'];
const subjectOf = (id) => subjects.find((s) => s.id === id) || subjects[0];

// 视频讲解：B站站内搜索直达（免 key、免审核，点开即看；自动嵌入需要平台审核与 key，故用搜索直达）
const videoUrl = (grade, unitName) =>
  `https://search.bilibili.com/all?keyword=${encodeURIComponent(`小学${grade || ''} ${unitName} 讲解`.trim())}`;
function VideoBtn({ grade, unit, small }) {
  if (!unit || unit === '综合') return null;
  return <a className={`video-btn${small ? ' small' : ''}`} href={videoUrl(grade, unit)} target="_blank" rel="noreferrer" title="去B站看视频讲解">🎬 视频讲解</a>;
}

// 图形题 SVG：多边形顶点数数 / 钟表（只显示题干时刻，不剧透答案）
function VisualSVG({ spec }) {
  if (!spec) return null;
  if (spec.kind === 'shape') {
    const pts = [];
    for (let i = 0; i < spec.sides; i += 1) {
      const a = (i / spec.sides) * Math.PI * 2 - Math.PI / 2;
      pts.push([60 + 42 * Math.cos(a), 60 + 42 * Math.sin(a)]);
    }
    return <svg className="visual-svg" viewBox="0 0 120 120" role="img" aria-label="图形"><polygon points={pts.map((p) => p.join(',')).join(' ')} fill="#e4f3ff" stroke="#247fbe" strokeWidth="5" strokeLinejoin="round" />{pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="6" fill="#247fbe" />)}</svg>;
  }
  if (spec.kind === 'clock') {
    const ang = (spec.hour % 12) * 30 * (Math.PI / 180);
    return <svg className="visual-svg" viewBox="0 0 120 120" role="img" aria-label="钟表"><circle cx="60" cy="60" r="52" fill="#fff" stroke="#6c63ff" strokeWidth="5" />{[...Array(12)].map((_, i) => { const a = (i * 30 * Math.PI) / 180; return <circle key={i} cx={60 + 43 * Math.sin(a)} cy={60 - 43 * Math.cos(a)} r={i % 3 === 0 ? 4 : 2} fill="#6c63ff" />; })}<line x1="60" y1="60" x2={60 + 26 * Math.sin(ang)} y2={60 - 26 * Math.cos(ang)} stroke="#243252" strokeWidth="6" strokeLinecap="round" /><line x1="60" y1="60" x2="60" y2="24" stroke="#ff7da8" strokeWidth="4" strokeLinecap="round" /><circle cx="60" cy="60" r="5" fill="#ffc94a" /></svg>;
  }
  return null;
}

const getAchv = () => { try { return JSON.parse(localStorage.getItem('kids-quiz-achv') || '{}'); } catch { return {}; } };
const addAchv = (key) => { const a = getAchv(); a[key] = (a[key] || 0) + 1; localStorage.setItem('kids-quiz-achv', JSON.stringify(a)); return a; };

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

  const title = useMemo(() => difficulties.find((item) => item.value === difficulty)?.name || '热身', [difficulty]);
  const q = questions[index];
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
        picked: value, answer: q.answer, prompt: q.prompt, visual: q.visual, options: q.options, explain: q.explain || '',
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
    {screen === 'game' && q && <GameView q={q} index={index} questionCount={questions.length} level={level} gameMode={gameMode} subject={subject} profileGrade={profile?.grade} lives={lives} streak={streak} stars={stars} answerState={answerState} message={message} activeRelics={activeRelics} relicUses={relicUses} passiveState={passiveState} armedEffects={armedEffects} hiddenOptions={hiddenOptions} revealedAnswer={revealedAnswer} onUseRelic={useRelic} onAnswer={answer} onBack={() => go('setup')} onRead={() => audio.speak(`${q.prompt}，${q.visual}，请选择正确答案`)} onReadExplain={() => audio.speak(q.explain || '再想一想吧')} onAskAI={() => askAbout({ ...q, picked: answerState?.value })} />}
    {screen === 'result' && <Result correct={correct} count={questions.length} level={level} lives={lives} bestStreak={bestStreak} passed={lives > 0 && correct >= Math.ceil(questions.length * 0.6)} selectedRelic={selectedRelic} setSelectedRelic={setSelectedRelic} activeRelics={activeRelics} runWrongs={runWrongs} gameMode={gameMode} suggestion={suggestion} onSuggestion={(diff) => startNormalQuiz(subject, diff)} onContinue={continueRun} onChange={() => go('setup')} onMistakes={() => go('mistakes')} onReport={() => go('report')} onRead={(t) => audio.speak(t)} />}
    {screen === 'mistakes' && <MistakesView mistakes={mistakes} profile={profile} onPractice={startMistakeQuiz} onMastered={async (id, v) => { await api.markMastered(id, v); setMistakes((list) => list.map((m) => (m.id === id ? { ...m, mastered: v ? 1 : 0 } : m))); }} onRead={(t) => audio.speak(t)} />}
    {screen === 'report' && <ReportView profile={profile} mastery={mastery} sessions={sessions} mistakes={mistakes} analysis={analysis} analysisMeta={analysisMeta} aiBusy={aiBusy} weakMap={weakMap} onAnalyze={runAnalyze} onAIQuiz={startAIQuiz} onPracticeUnit={practiceUnit} onMistakePractice={() => startMistakeQuiz()} onNormalPractice={(sid) => startNormalQuiz(subjectOf(sid), difficulty)} onRead={(t) => audio.speak(t)} />}
    {screen === 'tutor' && <TutorView profile={profile} subject={subject} profiles={profiles} mistakes={mistakes} msgs={tutorMsgs} setMsgs={setTutorMsgs} pendingAsk={pendingAsk} clearPendingAsk={() => setPendingAsk(null)} flash={flash} />}
    {screen === 'galaxy' && <GalaxyView profile={profile} mastery={mastery} aiBusy={aiBusy} onPracticeUnit={practiceUnit} />}
    {screen === 'settings' && <SettingsView profile={profile} setProfile={setProfile} refreshProfiles={refreshProfiles} flash={flash} />}
    <Fireworks active={fireworks} />
  </>;
}

const BANKS_COUNT = 100;

function Setup({ subject, setSubject, difficulty, setDifficulty, questionCount, setQuestionCount, profiles, profile, setProfile, refreshProfiles, title, memoryDue, weakMap, aiBusy, onBack, onStart, onAIStart }) {
  const [name, setName] = useState('');
  const addProfile = async () => {
    if (!name.trim()) return;
    const created = await api.createProfile({ name: name.trim(), grade: profile?.grade || '一年级' });
    setName(''); setProfile(created); refreshProfiles();
  };
  const setGrade = async (grade) => {
    if (!profile) return;
    const updated = await api.updateProfile(profile.id, { grade });
    setProfile(updated); refreshProfiles();
  };
  return <section className="screen active"><div className="setup-shell"><div className="section-heading"><button className="icon-btn" onClick={onBack}>←</button><div><span className="section-kicker">冒险准备</span><h2>定制你的知识之旅</h2></div><div className="step-pill">考纲 + AI 双驱动</div></div>
    <div className="setup-block profile-block"><div className="block-title"><span>👤</span><div><h3>个人档案</h3><p>AI为每位小探险家独立记录学情</p></div></div><div className="profile-controls"><select value={profile?.id || ''} onChange={(event) => setProfile(profiles.find((item) => item.id === Number(event.target.value)))}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.avatar} {item.name}</option>)}</select><input value={name} onChange={(event) => setName(event.target.value)} placeholder="新建昵称" maxLength="20" /><button className="secondary-btn" onClick={addProfile}>添加档案</button><div className="segmented grade-choice">{GRADES.map((g) => <button key={g} className={`choice-btn ${profile?.grade === g ? 'selected' : ''}`} onClick={() => setGrade(g)}>{g}</button>)}</div><span className="memory-note">📚 待复习 {memoryDue.length} 题</span></div></div>
    <div className="setup-block"><div className="block-title"><span>1</span><div><h3>选择一座主题岛</h3><p>到期复习题优先，薄弱知识点加练</p></div></div><div className="subject-grid">{subjects.map((item) => <button key={item.id} className={`subject-card ${subject.id === item.id ? 'selected' : ''}`} style={{ '--subject-color': item.color }} onClick={() => setSubject(item)}><span className="emoji">{item.emoji}</span><div className="name">{item.name}</div><div className="desc">{item.grades}</div>{(weakMap[item.id]?.length > 0) && <div className="weak-dot">🎯 加练{weakMap[item.id].length}个薄弱点</div>}</button>)}</div></div>
    <div className="setup-row"><div className="setup-block compact"><div className="block-title"><span>2</span><div><h3>挑战难度</h3><p>{difficulties.find((item) => item.value === difficulty)?.tip}</p></div></div><div className="segmented difficulty-choice">{difficulties.map((item) => <button key={item.value} className={`choice-btn ${difficulty === item.value ? 'selected' : ''}`} onClick={() => setDifficulty(item.value)}>{item.name}<small>{item.label}</small></button>)}</div></div><div className="setup-block compact"><div className="block-title"><span>3</span><div><h3>本层题量</h3><p>5层闯关，层层有增益</p></div></div><div className="segmented count-choice">{[5, 8, 10, 12].map((n) => <button key={n} className={`choice-btn ${questionCount === n ? 'selected' : ''}`} onClick={() => setQuestionCount(n)}>{n} 题</button>)}</div></div></div>
    <div className="launch-bar"><div className="launch-summary"><span>{subject.emoji}</span><p><b>{profile?.grade || '一年级'} · {subject.name}岛 · {title} · {questionCount}题</b><small>记忆复习优先 + 薄弱点自适应</small></p></div><div className="launch-actions"><button className="ghost-btn" disabled={aiBusy} onClick={() => onAIStart(subject.id, questionCount)}>{aiBusy ? '出题中…' : '🤖 AI专属题'}</button><button className="primary-btn" onClick={() => onStart()}>出发探险 ➜</button></div></div>
  </div></section>;
}

function GameView({ q, index, questionCount, level, gameMode, subject, profileGrade, lives, streak, stars, answerState, message, activeRelics, relicUses, passiveState, armedEffects, hiddenOptions, revealedAnswer, onUseRelic, onAnswer, onBack, onRead, onReadExplain, onAskAI }) {
  const keys = ['A', 'B', 'C', 'D'];
  return <section className={`screen active ${answerState?.isCorrect ? 'correct-hit' : ''}`} id="screen-game"><div className="game-shell"><div className="game-topbar"><button className="icon-btn" onClick={onBack}>←</button><div className="game-identity"><span>{subject.emoji}</span><div><b>{subject.name}岛{q.aiMade ? ' · AI专属' : ''}{gameMode === '错题重练' ? ' · 错题重练' : ''}</b><small>第 {level} / 5 层 · {knowledgeName(subject.id, q.knowledge)}</small></div></div><div className="game-stats"><div><span>❤️</span><b>{'❤️'.repeat(lives) || '0'}</b><small>生命</small></div><div><span>🔥</span><b>{streak}</b><small>连对</small></div><div><span>⭐</span><b>{stars}</b><small>星星</small></div></div></div><div className="progress-area"><div className="progress-meta"><span>第 {index + 1} / {questionCount} 题</span><span>{Math.round(index / questionCount * 100)}%</span></div><div className="progress-track"><div id="progress-fill" style={{ width: `${index / questionCount * 100}%` }} /><span id="progress-dog" style={{ left: `${index / questionCount * 100}%` }}>🐾</span></div></div><div className="game-content"><aside className="coach-card"><div className={`coach-mascot ${answerState?.isCorrect ? 'happy' : ''}`}>🐶</div><div className="coach-bubble">{message}</div><RelicInventory relics={activeRelics} relicUses={relicUses} passiveState={passiveState} armedEffects={armedEffects} lives={lives} streak={streak} index={index} questionCount={questionCount} answerState={answerState} hiddenOptions={hiddenOptions} revealedAnswer={revealedAnswer} onUse={onUseRelic} /></aside><div className="quiz-column">{answerState?.isCorrect && <CorrectEffect key={`${q.id}-${index}`} streak={streak} earnedStars={answerState.earnedStars} />}<article className="question-card"><div className="question-header"><span className="type-tag">{q.type}{q.review ? ' · 待复习' : ''}</span><button className="read-btn" onClick={onRead}>🔈 读题</button></div><h2>{q.prompt}</h2><div className="question-extra">{q.svg ? <VisualSVG spec={q.svg} /> : <div className="visual-word">{q.visual}</div>}</div><p className="question-hint">{revealedAnswer ? '水晶正在提示正确答案' : '选出你认为正确的答案'}</p></article><div className="answers">{q.options.map((option, i) => {
    const isAnswer = String(option) === String(q.answer);
    const isPicked = answerState && String(option) === String(answerState.value);
    const eliminated = hiddenOptions.some((h) => String(h) === String(option));
    const revealed = revealedAnswer && isAnswer;
    return <button key={`${option}-${i}`} className={`answer ${answerState ? 'disabled' : ''} ${answerState && isAnswer ? 'correct' : ''} ${isPicked && !answerState?.isCorrect ? 'wrong' : ''} ${eliminated ? 'eliminated' : ''} ${revealed ? 'revealed' : ''}`} disabled={Boolean(answerState) || eliminated} onClick={() => onAnswer(option)}><span className="option-key">{keys[i] || ''}</span>{option}</button>;
  })}</div>
  {answerState && !answerState.isCorrect && q.explain && <div className="explain-card"><div className="explain-title">🧑‍🏫 小老师讲题 · {knowledgeName(subject.id, q.knowledge)}</div><p>{q.explain}</p><div className="explain-actions"><button className="secondary-btn" onClick={onReadExplain}>🔈 听讲解</button><button className="secondary-btn" onClick={onAskAI}>🤖 问AI老师</button><VideoBtn grade={profileGrade} unit={knowledgeName(subject.id, q.knowledge)} /></div></div>}
  </div></div></div></section>;
}

function CorrectEffect({ streak, earnedStars = 1 }) {
  const pieces = ['⭐', '✦', '●', '◆', '★', '✿', '●', '✦', '⭐', '◆', '★', '✿', '●', '★', '◆', '✦', '⭐', '●', '✿', '◆', '★', '✦', '●', '⭐'];
  return <div className="correct-effect" aria-live="polite"><div className="correct-flash" aria-hidden="true" /><div className="correct-rings" aria-hidden="true" /><div className="correct-pop"><span>✓</span><b>{streak > 1 ? `完美连击 × ${streak}` : '漂亮！答对啦'}</b><small>+{earnedStars} ⭐</small></div>{pieces.map((piece, index) => { const angle = index / pieces.length * Math.PI * 2; const distance = 150 + index % 4 * 32; return <i key={index} aria-hidden="true" style={{ '--x': `${Math.cos(angle) * distance}px`, '--y': `${Math.sin(angle) * distance}px`, '--spin': `${index % 2 ? 240 : -240}deg`, '--delay': `${index % 5 * 12}ms` }}>{piece}</i>; })}</div>;
}

function RelicInventory({ relics: ownedRelics, relicUses, passiveState, armedEffects, lives, streak, index, questionCount, answerState, hiddenOptions, revealedAnswer, onUse }) {
  if (!ownedRelics.length) return <div className="relic-inventory empty"><div className="inventory-title"><b>🎒 道具背包</b><span>闯过本层即可获得</span></div></div>;
  const groups = [['active', '主动道具'], ['passive', '被动道具']];
  const statusFor = (relic) => {
    if (relic.type === 'active') {
      const uses = relicUses[relic.id] || 0;
      if (relic.id === 'double-badge' && armedEffects.double) return '加成已准备';
      if (relic.id === 'guard-bubble' && armedEffects.guard) return '泡泡保护中';
      if (!uses) return '已用完';
      if (relic.id === 'life-potion' && lives >= 4) return '生命已满';
      if (relic.id === 'answer-crystal' && revealedAnswer) return '本题已提示';
      if (relic.id === 'hint-lens' && hiddenOptions.length >= 2) return '本题已排除 2 个';
      return `可用 · ${uses} 次`;
    }
    if (relic.id === 'lucky-clover') return passiveState.cloverUsed ? '本层已触发' : '等待保护';
    if (relic.id === 'wisdom-crown') return passiveState.crownUsed ? '本层已触发' : '等待首个答对';
    if (relic.id === 'light-feather') return `再连对 ${streak % 2 === 0 ? 2 : 1} 题`;
    if (relic.id === 'streak-drum') return `再连对 ${3 - streak % 3} 题`;
    if (relic.id === 'trail-map') return index === questionCount - 1 ? '本题可触发' : '最后一题触发';
    if (relic.id === 'brave-heart') return lives === 1 ? '正在生效' : '生命为 1 时生效';
    return '持续生效';
  };
  const disabledFor = (relic) => {
    if (relic.type !== 'active' || answerState || (relicUses[relic.id] || 0) <= 0) return true;
    if (relic.id === 'life-potion') return lives >= 4;
    if (relic.id === 'answer-crystal') return revealedAnswer;
    if (relic.id === 'hint-lens') return hiddenOptions.length >= 2;
    if (relic.id === 'double-badge') return Boolean(armedEffects.double);
    if (relic.id === 'guard-bubble') return Boolean(armedEffects.guard);
    return false;
  };
  return <div className="relic-inventory"><div className="inventory-title"><b>🎒 道具背包</b><span>{ownedRelics.length} 件</span></div>{groups.map(([type, label]) => { const items = ownedRelics.filter((item) => item.type === type); return items.length > 0 && <div className="relic-group" key={type}><div className={`relic-group-label ${type}`}>{label}<small>{type === 'active' ? '点击使用' : '自动生效'}</small></div><div className="owned-relics">{items.map((relic) => <button type="button" key={relic.id} className={`owned-relic ${relic.type}`} disabled={disabledFor(relic)} onClick={() => onUse(relic)} title={relic.desc}><span className="owned-relic-icon">{relic.icon}</span><span className="owned-relic-copy"><b>{relic.name}</b><small>{statusFor(relic)}</small></span></button>)}</div></div>; })}</div>;
}

function Result({ correct, count, level, lives, bestStreak, passed, selectedRelic, setSelectedRelic, activeRelics, runWrongs, gameMode, suggestion, onSuggestion, onContinue, onChange, onMistakes, onReport, onRead }) {
  const ownedIds = activeRelics.map((item) => item.id).join(',');
  const options = useMemo(() => shuffle(relics.filter((item) => !ownedIds.split(',').includes(item.id))).slice(0, 3), [ownedIds]);
  return <section className="screen active" id="screen-result"><div className="result-shell"><div className="result-badge">{passed ? '🏆' : '🧭'}</div><span className="section-kicker">探险报告 · {gameMode}</span><h2>{passed ? (level >= 5 ? '知识岛通关成功！' : `第 ${level} 层通过！`) : '冒险暂时结束'}</h2><p>{passed ? '选择一个随机增益，继续深入知识岛。' : '带着经验回到营地，下一次一定走得更远。'}</p><div className="result-stars">{'⭐'.repeat(correct)}{'☆'.repeat(count - correct)}</div><div className="result-stats"><div><span className="stat-icon mint">✓</span><p><b>{correct}/{count}</b><small>答对题目</small></p></div><div><span className="stat-icon yellow">◎</span><p><b>{Math.round(correct / count * 100)}%</b><small>正确率</small></p></div><div><span className="stat-icon pink">🔥</span><p><b>{bestStreak}</b><small>最高连对</small></p></div></div>
  {runWrongs.length > 0 && <div className="run-wrongs"><b>📕 本局错题 {runWrongs.length} 道，已收入错题本</b>{runWrongs.slice(0, 4).map((w, i) => <button key={i} className="wrong-chip" onClick={() => onRead(`${w.prompt}。正确答案是${w.answer}。${w.explain || ''}`)}>❌ {w.prompt.length > 18 ? `${w.prompt.slice(0, 18)}…` : w.prompt}</button>)}</div>}
  {suggestion && <div className="suggest-banner"><span>🤖 威威建议：本局正确率 {Math.round(correct / count * 100)}%，下局<b>{suggestion.label}</b>更有收获！</span><button className="secondary-btn" onClick={() => onSuggestion(suggestion.diff)}>采纳并开新局</button></div>}
  {passed && level < 5 && <div className="relic-choice">{options.map((item) => <button key={item.name} className={`relic-card ${selectedRelic?.name === item.name ? 'selected' : ''}`} onClick={() => setSelectedRelic(item)}><span className={`relic-type ${item.type}`}>{item.type === 'active' ? '主动 · 可点击' : '被动 · 自动触发'}</span><strong>{item.icon}</strong><b>{item.name}</b><small>{item.desc}</small></button>)}</div>}<div className="result-actions"><button className="primary-btn" disabled={passed && level < 5 && !selectedRelic} onClick={onContinue}>{passed && level < 5 ? '选择增益后继续 ➜' : '重新挑战 🔄'}</button><button className="secondary-btn" onClick={onMistakes}>📕 错题本</button><button className="secondary-btn" onClick={onReport}>🤖 AI分析</button><button className="secondary-btn" onClick={onChange}>更换设置</button></div></div></section>;
}

function MistakesView({ mistakes, profile, onPractice, onMastered, onRead }) {
  const [filter, setFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const open = mistakes.filter((m) => !m.mastered);
  const done = mistakes.filter((m) => m.mastered);
  const scoped = filter ? open.filter((m) => m.subject_id === filter) : open;
  const unitOptions = [...new Map(scoped.map((m) => [m.knowledge || '综合', m])).entries()]
    .map(([k, m]) => ({ id: k, name: knowledgeName(m.subject_id, k), count: scoped.filter((x) => (x.knowledge || '综合') === k).length }));
  const list = unitFilter ? scoped.filter((m) => (m.knowledge || '综合') === unitFilter) : scoped;
  const pickFilter = (sid) => { setFilter(sid); setUnitFilter(''); };
  return <section className="screen active"><div className="panel-shell"><div className="section-heading"><div><span className="section-kicker">📕 错题本</span><h2>{profile?.name}的错题本</h2>      <p className="muted">答错自动归集 · 答对巩固后自动毕业 · 共{open.length}道待攻克 / {done.length}道已掌握</p></div><button className="primary-btn" disabled={!open.length} onClick={() => onPractice()}>▶ 错题重练 ({Math.min(10, open.length)}题)</button></div>
    <div className="chip-row"><button className={`chip ${!filter ? 'selected' : ''}`} onClick={() => pickFilter('')}>全部</button>{subjects.map((s) => <button key={s.id} className={`chip ${filter === s.id ? 'selected' : ''}`} onClick={() => pickFilter(s.id)}>{s.emoji}{s.name}</button>)}</div>
    <div className="unit-filter-row"><select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} aria-label="按单元筛选"><option value="">全部单元</option>{unitOptions.map((u) => <option key={u.id} value={u.id}>{u.name}（{u.count}道）</option>)}</select>{unitFilter && <button className="primary-btn" onClick={() => onPractice(list)}>▶ 只练【{unitOptions.find((u) => u.id === unitFilter)?.name}】({Math.min(10, list.length)}题)</button>}</div>
    {!list.length ? <div className="empty-card">🎉 太棒了，这里没有待攻克的错题！去闯关收集星星吧。</div> :
    <div className="mistake-list">{list.map((m) => <article key={m.id} className="mistake-card"><div className="mistake-head"><span className="type-tag">{subjectOf(m.subject_id).name} · {knowledgeName(m.subject_id, m.knowledge)}</span><span className="wrong-times">错×{m.wrong_count}</span></div><h3>{m.prompt}</h3><div className="mistake-rows"><span>你的答案：<b className="bad">{m.picked || '—'}</b></span><span>正确答案：<b className="good">{m.answer}</b></span></div>{m.explain && <p className="mistake-explain">🧑‍🏫 {m.explain}</p>}<div className="mistake-actions"><button className="secondary-btn" onClick={() => onRead(`${m.prompt}。正确答案是${m.answer}。${m.explain || ''}`)}>🔈 朗读</button><VideoBtn grade={profile?.grade} unit={knowledgeName(m.subject_id, m.knowledge)} small /><button className="secondary-btn" onClick={() => onMastered(m.id, true)}>✅ 我会了</button></div></article>)}</div>}
  </div></section>;
}

// 学习路径：按年级列出本册单元体系树，状态来自掌握度，点击直达专练
function PathPanel({ profile, mastery, aiBusy, onPracticeUnit }) {
  const [pathSubject, setPathSubject] = useState('math');
  const gradeChar = String(profile?.grade || '一年级')[0];
  const units = (KNOWLEDGE[pathSubject] || []).filter((k) => isUnitId(k.id) && String(k.grade).includes(gradeChar));
  const statusOf = (kid) => {
    const r = (mastery?.knowledge || []).find((x) => x.subjectId === pathSubject && x.knowledge === kid);
    if (!r) return { dot: '⚪', label: '未学', rate: null };
    const rate = Math.round((r.correct / r.total) * 100);
    if (rate >= 80 && r.total >= 3) return { dot: '🟢', label: `已掌握 ${rate}%`, rate };
    return { dot: '🟡', label: `学习中 ${rate}%`, rate };
  };
  const nextUp = units.find((u) => statusOf(u.id).rate === null) || units.find((u) => (statusOf(u.id).rate ?? 100) < 80);
  return <div className="setup-block"><div className="block-title"><span>🗺️</span><div><h3>{profile?.grade} · 学习路径</h3><p>沿着教材体系走，绿了就是掌握{nextUp ? `，下一站：${nextUp.name}` : ''}</p></div></div>
    <div className="chip-row">{subjects.map((s) => <button key={s.id} className={`chip ${pathSubject === s.id ? 'selected' : ''}`} onClick={() => setPathSubject(s.id)}>{s.emoji}{s.name}</button>)}</div>
    {!units.length ? <p className="muted">该年级暂无单元目录。</p> :
    <div className="path-list">{units.map((u, i) => { const st = statusOf(u.id); return <div key={u.id} className="path-row"><span className="path-dot">{st.dot}</span><span className="path-name">{i + 1}. {u.name}<small>{u.grade} · {st.label}</small></span><button className="mini-btn" disabled={aiBusy} onClick={() => onPracticeUnit(pathSubject, u.id)}>专练</button><VideoBtn grade={profile?.grade} unit={u.name} small /></div>; })}</div>}
  </div>;
}

// 本周计划：规则引擎按薄弱→复习→新知→错题→挑战排布，一键开练
function WeekPlan({ profile, weakMap, mistakes, aiBusy, onPracticeUnit, onMistakePractice, onNormalPractice }) {
  const weakList = Object.entries(weakMap || {}).flatMap(([sid, ks]) => (ks || []).map((k) => ({ sid, k, name: knowledgeName(sid, k) })));
  const gradeChar = String(profile?.grade || '一年级')[0];
  const freshUnit = (() => {
    const sid = weakList[0]?.sid || 'math';
    return (KNOWLEDGE[sid] || []).find((k) => isUnitId(k.id) && String(k.grade).includes(gradeChar) && !(weakMap[sid] || []).includes(k.id));
  })();
  const openCount = (mistakes || []).filter((m) => !m.mastered).length;
  const items = [
    weakList[0] && { day: '周一', title: `火力全开：${weakList[0].name}专练×5`, run: { kind: 'unit', sid: weakList[0].sid, unit: weakList[0].k } },
    openCount > 0 && { day: '周二', title: `错题清零（还有${openCount}道）`, run: { kind: 'mistake' } },
    freshUnit && { day: '周三', title: `新征程：${freshUnit.name}`, run: { kind: 'unit', sid: weakList[0]?.sid || 'math', unit: freshUnit.id } },
    weakList[1] && { day: '周四', title: `查漏补缺：${weakList[1].name}专练×5`, run: { kind: 'unit', sid: weakList[1].sid, unit: weakList[1].k } },
    { day: '周五', title: `周末挑战赛：${subjectOf(weakList[0]?.sid || 'math').name}混合闯关`, run: { kind: 'normal', sid: weakList[0]?.sid || 'math' } },
  ].filter(Boolean);
  const run = (item) => {
    if (aiBusy) return;
    if (item.run.kind === 'unit') onPracticeUnit(item.run.sid, item.run.unit);
    else if (item.run.kind === 'mistake') onMistakePractice();
    else onNormalPractice(item.run.sid);
  };
  if (!items.length || (!weakList.length && !openCount && !freshUnit)) return null;
  return <div className="setup-block"><div className="block-title"><span>📅</span><div><h3>本周学习计划</h3><p>Agent 按你的学情自动排布，完成一项就点一项</p></div></div>
    <div className="plan-list">{items.map((item) => <div key={item.day} className="plan-row"><span className="plan-day">{item.day}</span><span className="plan-title">{item.title}</span><button className="mini-btn" disabled={aiBusy} onClick={() => run(item)}>{aiBusy ? '出题中…' : '开练 ➜'}</button></div>)}</div>
  </div>;
}

function ReportView({ profile, mastery, sessions, mistakes, analysis, analysisMeta, aiBusy, weakMap, onAnalyze, onAIQuiz, onPracticeUnit, onMistakePractice, onNormalPractice, onRead }) {
  const acc = profile?.attempts ? Math.round((profile.correct_answers / profile.attempts) * 100) : 0;
  const perfects = getAchv().perfect || 0;
  const [subjectFilter, setSubjectFilter] = useState('');
  const bySubject = {};
  (mastery?.knowledge || []).forEach((row) => { (bySubject[row.subjectId] ||= []).push(row); });
  const shownSubjects = Object.entries(bySubject).filter(([sid]) => !subjectFilter || sid === subjectFilter);
  return <section className="screen active"><div className="panel-shell"><div className="section-heading"><div><span className="section-kicker">🤖 AI学情</span><h2>{profile?.name}的学习报告</h2><p className="muted">累计答题 {profile?.attempts || 0} · 正确率 {acc}% · 闯关 {sessions?.length || 0} 次{perfects > 0 ? ` · 🏆满分×${perfects}` : ''}</p></div><button className="primary-btn" disabled={aiBusy} onClick={onAnalyze}>{aiBusy ? '分析中…' : '✨ 生成AI分析'}</button></div>
    {analysisMeta?.fallback && <div className="warn-card">AI老师暂时忙，以下是本地统计，稍后再试一次分析吧。</div>}
    {analysis ? <article className="analysis-card"><div className="explain-title">🤖 AI老师的分析 <small>{analysisMeta?.model ? `· ${analysisMeta.model}` : ''}</small></div>{analysis.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}<button className="secondary-btn" onClick={() => onRead(analysis.slice(0, 380))}>🔈 朗读报告</button></article> : <div className="empty-card">点右上角「生成AI分析」，让AI老师总结强项、薄弱点和本周小目标吧。</div>}
    <WeekPlan profile={profile} weakMap={weakMap} mistakes={mistakes} aiBusy={aiBusy} onPracticeUnit={onPracticeUnit} onMistakePractice={onMistakePractice} onNormalPractice={onNormalPractice} />
    <PathPanel profile={profile} mastery={mastery} aiBusy={aiBusy} onPracticeUnit={onPracticeUnit} />
    <div className="setup-block"><div className="block-title"><span>🎯</span><div><h3>知识点掌握度</h3><p>正确率低于60%会被标为薄弱点，自动加练</p></div></div>
      <div className="chip-row"><button className={`chip ${!subjectFilter ? 'selected' : ''}`} onClick={() => setSubjectFilter('')}>全部学科</button>{Object.keys(bySubject).map((sid) => <button key={sid} className={`chip ${subjectFilter === sid ? 'selected' : ''}`} onClick={() => setSubjectFilter(sid)}>{subjectOf(sid).emoji}{subjectOf(sid).name}</button>)}</div>
      {!shownSubjects.length ? <p className="muted">还没有数据，先去闯关吧！</p> :
      shownSubjects.map(([sid, rows]) => <div key={sid} className="mastery-group"><b>{subjectOf(sid).emoji} {subjectOf(sid).name}</b>{rows.map((row) => { const rate = Math.round((row.correct / row.total) * 100); const weak = row.total >= 2 && rate < 60; const ug = unitGrade(sid, row.knowledge); return <div key={row.knowledge} className="mastery-row"><span className="mastery-name">{knowledgeName(sid, row.knowledge)}{weak ? ' 🎯' : ''}{ug !== '综合' && <small className="unit-grade">{ug}</small>}</span><div className="mastery-bar"><i style={{ width: `${rate}%` }} className={weak ? 'weak' : ''} /></div><span className="mastery-rate">{rate}%</span><button className="mini-btn" onClick={() => onAIQuiz(sid, 5)}>AI出题</button><a className="mini-btn" href={videoUrl(profile?.grade, knowledgeName(sid, row.knowledge))} target="_blank" rel="noreferrer" title="看视频讲解">🎬</a></div>; })}</div>)}
    </div>
    {!!sessions?.length && <div className="setup-block"><div className="block-title"><span>🧭</span><div><h3>最近闯关</h3><p>每次挑战都被记录下来</p></div></div><div className="session-list">{sessions.slice(0, 6).map((s) => <div key={s.id} className="session-chip">{subjectOf(s.subject_id).emoji} {s.mode} {s.correct}/{s.total} · 第{s.level}层</div>)}</div></div>}
  </div></section>;
}

function TutorView({ profile, subject, profiles, mistakes, msgs, setMsgs, pendingAsk, clearPendingAsk, flash }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const bottomRef = useRef(null);
  const accuracy = profile?.attempts ? Math.round((profile.correct_answers / profile.attempts) * 100) : null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => () => { voiceModeRef.current = false; stopSpeak(); }, []);

  const context = () => ({
    profileName: profile?.name, grade: profile?.grade || '一年级',
    subject: subject?.name, accuracy,
    mistakes: (mistakes || []).filter((m) => !m.mastered).slice(0, 5),
  });

  const send = async (text, { spoken = false } = {}) => {
    const content = String(text).trim();
    if (!content || busy) return;
    stopSpeak();
    const next = [...msgs, { role: 'user', content }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const data = await api.aiChat(next.slice(-12), context());
      setMsgs((list) => [...list, { role: 'assistant', content: data.reply, model: data.model }]);
      if (autoSpeak || spoken || voiceModeRef.current) speak(data.reply);
      if (voiceModeRef.current) {
        window.setTimeout(() => voiceLoop(), 600);
      }
    } catch (e) {
      setMsgs((list) => [...list, { role: 'assistant', content: `哎呀，信号不太好：${e.message}。先看看错题本，或者换一道题试试吧！` }]);
      if (voiceModeRef.current) { voiceModeRef.current = false; setVoiceMode(false); }
    } finally { setBusy(false); }
  };

  // speech to speech 循环:听 → 问AI → 播报 → 继续听
  const voiceLoop = async () => {
    if (!voiceModeRef.current || busy) return;
    setListening(true);
    try {
      const text = await listenOnce();
      setListening(false);
      await send(text, { spoken: true });
    } catch (e) {
      setListening(false);
      if (voiceModeRef.current) { flash(e.message); voiceModeRef.current = false; setVoiceMode(false); }
    }
  };
  const toggleVoice = () => {
    if (voiceModeRef.current) { voiceModeRef.current = false; setVoiceMode(false); stopSpeak(); return; }
    if (!speechSupported()) { flash('当前浏览器不支持语音输入，请用文字聊天（推荐Chrome/Edge）'); return; }
    voiceModeRef.current = true; setVoiceMode(true); flash('语音对话开始：说话吧，说完我就会回答');
    voiceLoop();
  };
  const micOnce = async () => {
    if (busy || listening) return;
    setListening(true);
    try { const text = await listenOnce(); setListening(false); send(text, { spoken: true }); }
    catch (e) { setListening(false); flash(e.message); }
  };

  useEffect(() => {
    if (pendingAsk) {
      send(`请讲讲这道题：${pendingAsk.prompt}，选项有${(pendingAsk.options || []).join('、')}，正确答案是${pendingAsk.answer}${pendingAsk.picked ? `，我选了${pendingAsk.picked}` : ''}。`);
      clearPendingAsk();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk]);

  const chips = ['讲讲我的错题', `考考我的${subject?.name}`, '鼓励我一下', '教我一个记忆小窍门'];
  const chipSend = (chip) => {
    if (chip === '讲讲我的错题') {
      const open = (mistakes || []).filter((m) => !m.mastered).slice(0, 3);
      send(open.length ? `这是我最近的错题：${open.map((m) => `${m.prompt}（答案${m.answer}，我选了${m.picked}）`).join('；')}。请挑最关键的一道讲一讲。` : '我最近没有错题，请夸夸我并出一道挑战题。');
    } else send(chip);
  };

  return <section className="screen active"><div className="panel-shell tutor-shell"><div className="section-heading"><div><span className="section-kicker">🎙️ AI老师 · 语音对话</span><h2>跟威威老师说话吧</h2><p className="muted">{profile?.name} · {profile?.grade} · {speechSupported() ? '支持语音对话' : '当前浏览器仅支持文字+朗读'} · {ttsSupported() ? '支持语音播报' : ''}</p></div><div className="tutor-toggles"><button className={`chip ${autoSpeak ? 'selected' : ''}`} onClick={() => { setAutoSpeak(!autoSpeak); if (autoSpeak) stopSpeak(); }}>🔈 自动播报</button><button className={`chip ${voiceMode ? 'selected' : ''}`} onClick={toggleVoice}>{voiceMode ? '⏹ 结束对话' : '🎙️ 连续对话'}</button></div></div>
    <div className="chat-list">{msgs.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}><span className="chat-avatar">{m.role === 'assistant' ? '🐶' : (profile?.avatar || '🧒')}</span><div className="chat-bubble">{m.content}{m.role === 'assistant' && <button className="mini-btn" onClick={() => speak(m.content)}>🔈</button>}</div></div>)}{busy && <div className="chat-msg assistant"><span className="chat-avatar">🐶</span><div className="chat-bubble typing">威威思考中…</div></div>}<div ref={bottomRef} /></div>
    <div className="chip-row">{chips.map((c) => <button key={c} className="chip" onClick={() => chipSend(c)}>{c}</button>)}</div>
    <div className="chat-input-row"><button className={`mic-btn ${listening ? 'listening' : ''}`} onClick={micOnce} aria-label="语音输入">{listening ? '👂…' : '🎤'}</button><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(input)} placeholder={listening ? '正在听你说话…' : '打字或按话筒说话…'} maxLength="500" /><button className="primary-btn" disabled={busy || !input.trim()} onClick={() => send(input)}>发送</button></div>
  </div></section>;
}

// 知识星图：每个知识点是一个点，掌握即点亮；只读当前档案，只能看自己的
function GalaxyView({ profile, mastery, aiBusy, onPracticeUnit }) {
  const [fSubject, setFSubject] = useState('');
  const [fGrade, setFGrade] = useState('');
  const [fTerm, setFTerm] = useState('');
  const [selected, setSelected] = useState(null);
  const rows = mastery?.knowledge || [];
  const statOf = (sid, kid) => {
    const r = rows.find((x) => x.subjectId === sid && x.knowledge === kid);
    if (!r) return { status: 'fresh', rate: null, total: 0, correct: 0 };
    const rate = Math.round((r.correct / r.total) * 100);
    if (rate >= 80 && r.total >= 3) return { status: 'lit', rate, total: r.total, correct: r.correct };
    return { status: 'learning', rate, total: r.total, correct: r.correct };
  };
  const matchGrade = (g) => !fGrade || String(g).includes(fGrade);
  const matchTerm = (k) => {
    if (!fTerm) return true;
    if (fTerm === '上') return /-\da-/.test(k.id) || String(k.grade).includes('上');
    return /-\db-/.test(k.id) || String(k.grade).includes('下');
  };
  const sids = fSubject ? [fSubject] : subjects.map((s) => s.id);
  const sections = sids.map((sid) => ({
    sid,
    units: (KNOWLEDGE[sid] || []).filter((k) => matchGrade(k.grade) && matchTerm(k)),
  })).filter((sec) => sec.units.length > 0);
  let lit = 0, learning = 0, total = 0;
  sections.forEach((sec) => sec.units.forEach((u) => {
    total += 1;
    const st = statOf(sec.sid, u.id).status;
    if (st === 'lit') lit += 1; else if (st === 'learning') learning += 1;
  }));
  const rate = total ? Math.round((lit / total) * 100) : 0;
  const sel = selected ? { ...selected, meta: (KNOWLEDGE[selected.sid] || []).find((k) => k.id === selected.kid), st: statOf(selected.sid, selected.kid) } : null;
  return <section className="screen active"><div className="panel-shell"><div className="section-heading"><div><span className="section-kicker">🗺️ 知识星图</span><h2>{profile?.name}的星空</h2><p className="muted">只展示当前档案 · 点亮 {lit}/{total}（{rate}%）· 🟡学习中 {learning} · ⚪未学 {total - lit - learning}</p></div>{selected && <button className="secondary-btn" onClick={() => setSelected(null)}>关闭详情</button>}</div>
    <div className="galaxy-progress"><i style={{ width: `${rate}%` }} /></div>
    <div className="chip-row"><button className={`chip ${!fSubject ? 'selected' : ''}`} onClick={() => setFSubject('')}>全部学科</button>{subjects.map((s) => <button key={s.id} className={`chip ${fSubject === s.id ? 'selected' : ''}`} onClick={() => setFSubject(s.id)}>{s.emoji}{s.name}</button>)}</div>
    <div className="chip-row"><button className={`chip ${!fGrade ? 'selected' : ''}`} onClick={() => setFGrade('')}>全部年级</button>{[...GRADES, '启蒙'].map((g) => <button key={g} className={`chip ${fGrade === g ? 'selected' : ''}`} onClick={() => setFGrade(g)}>{g}</button>)}<span className="chip-sep" /><button className={`chip ${!fTerm ? 'selected' : ''}`} onClick={() => setFTerm('')}>上下册</button><button className={`chip ${fTerm === '上' ? 'selected' : ''}`} onClick={() => setFTerm('上')}>上册</button><button className={`chip ${fTerm === '下' ? 'selected' : ''}`} onClick={() => setFTerm('下')}>下册</button></div>
    <div className="galaxy-legend"><span>🟢 已掌握（≥80%且≥3题）</span><span>🟡 学习中</span><span>⚪ 未学</span><span>点击星星查看详情、可直接专练</span></div>
    {sections.map((sec) => { const s = subjectOf(sec.sid); const secLit = sec.units.filter((u) => statOf(sec.sid, u.id).status === 'lit').length; return <div key={sec.sid} className="galaxy-section"><div className="galaxy-section-head"><b>{s.emoji} {s.name}</b><span>{secLit}/{sec.units.length}</span></div><div className="galaxy-grid">{sec.units.map((u) => { const st = statOf(sec.sid, u.id); return <button key={u.id} className={`star ${st.status}`} style={{ '--subject-color': s.color }} title={`${u.name}（${u.grade}）${st.rate === null ? '' : ` · ${st.rate}%`}`} aria-label={`${u.name} ${st.status}`} onClick={() => setSelected({ sid: sec.sid, kid: u.id })} />; })}</div></div>; })}
    {sel?.meta && <div className="star-detail"><div><b>{subjectOf(sel.sid).emoji} {sel.meta.name}</b><p className="muted">{sel.meta.grade} · {sel.meta.desc}</p><p className="muted">{sel.st.status === 'lit' ? `🟢 已掌握（答对 ${sel.st.correct}/${sel.st.total}）` : sel.st.status === 'learning' ? `🟡 学习中（答对 ${sel.st.correct}/${sel.st.total}）` : '⚪ 还没学过，从这里开始点亮吧'}</p></div><div className="star-detail-actions"><button className="primary-btn" disabled={aiBusy} onClick={() => onPracticeUnit(sel.sid, sel.kid)}>{aiBusy ? '出题中…' : '⚡ 专练点亮'}</button><VideoBtn grade={profile?.grade} unit={sel.meta.name} /></div></div>}
  </div></section>;
}

function SettingsView({ profile, setProfile, refreshProfiles, flash }) {
  const [form, setForm] = useState({ baseUrl: '', apiKey: '', model: '', fallbacks: '' });
  const [saved, setSaved] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probing, setProbing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [grade, setGrade] = useState(profile?.grade || '一年级');
  useEffect(() => { setGrade(profile?.grade || '一年级'); }, [profile?.id]);
  useEffect(() => {
    api.getSettings()
      .then((data) => { setSaved(data); setForm((f) => ({ ...f, baseUrl: data.baseUrl || '', model: data.model || '', fallbacks: data.fallbacks || '' })); })
      .catch((e) => flash(e.message))
      .finally(() => setLoading(false));
    api.models().then((data) => setModels(data.models || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const saveGrade = async (g) => { setGrade(g); if (profile) { const updated = await api.updateProfile(profile.id, { grade: g }); setProfile(updated); refreshProfiles(); } };
  const save = async () => {
    setSaving(true);
    try {
      const data = await api.saveSettings({ baseUrl: form.baseUrl.trim(), apiKey: form.apiKey.trim(), model: form.model.trim(), fallbacks: form.fallbacks.trim() });
      setForm((f) => ({ ...f, apiKey: '' }));
      const refreshed = await api.getSettings();
      setSaved(refreshed);
      flash(data.model ? `已保存到数据库，当前模型：${data.model}` : '已保存到数据库（尚未选择模型，AI功能暂不可用）');
    } catch (e) { flash(e.message); } finally { setSaving(false); }
  };
  const refreshModels = async () => {
    setTesting(true);
    try {
      const data = await api.models();
      setModels(data.models || []);
      flash(`模型列表共 ${data.models?.length || 0} 个${data.currentModel ? `，当前已选：${data.currentModel}` : '，尚未选择模型'}`);
    } catch (e) { flash(e.message); } finally { setTesting(false); }
  };
  const probe = async () => {
    setProbing(true);
    try {
      const data = await api.modelsProbe();
      await api.saveSettings({ model: data.working });
      setForm((f) => ({ ...f, model: data.working }));
      const refreshed = await api.getSettings();
      setSaved(refreshed);
      flash(`找到可用模型 ${data.working}，已保存到数据库`);
    } catch (e) { flash(e.message); } finally { setProbing(false); }
  };
  const resetAll = async () => {
    try {
      await api.resetSettings();
      const refreshed = await api.getSettings();
      setSaved(refreshed);
      setForm({ baseUrl: '', apiKey: '', model: '', fallbacks: '' });
      flash('已恢复默认（清空数据库覆盖）');
    } catch (e) { flash(e.message); }
  };
  if (loading) return <section className="screen active"><div className="panel-shell"><div className="empty-card">设置加载中…</div></div></section>;
  return <section className="screen active"><div className="panel-shell"><div className="section-heading"><div><span className="section-kicker">⚙️ 设置</span><h2>学习与AI设置</h2><p className="muted">大模型配置保存在服务器数据库，重启不丢失{saved?.customized ? '（已自定义）' : '（当前为默认）'}</p></div></div>
    <div className="setup-block"><div className="block-title"><span>🎒</span><div><h3>年级</h3><p>决定AI出题与讲解的难度</p></div></div><div className="segmented difficulty-choice">{GRADES.map((g) => <button key={g} className={`choice-btn ${grade === g ? 'selected' : ''}`} onClick={() => saveGrade(g)}>{g}</button>)}</div></div>
    <div className="setup-block"><div className="block-title"><span>🤖</span><div><h3>大模型接入</h3><p>OpenAI兼容协议 · 配置存数据库 · 不指定默认模型</p></div></div>
      <div className="form-grid">
        <label>网关地址（留空用默认）<input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder={saved?.effectiveBaseUrl || 'https://...'} /></label>
        <label>模型（必选：下拉选择，或手动输入）{models.length ? <select value={showManual ? '__manual' : form.model} onChange={(e) => { if (e.target.value === '__manual') { setShowManual(true); } else { setShowManual(false); setForm({ ...form, model: e.target.value }); } }}><option value="">— 请选择模型 —</option>{models.map((m) => <option key={m} value={m}>{m}</option>)}<option value="__manual">⌨️ 手动输入…</option></select> : <span className="muted">点下方「刷新模型列表」加载</span>}{showManual && <input value={models.includes(form.model) ? '' : form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="手动输入模型名" />}</label>
        <label>兜底模型（可选，逗号分隔，主模型无通道时自动切换）<input value={form.fallbacks} onChange={(e) => setForm({ ...form, fallbacks: e.target.value })} placeholder="留空则不兜底" /></label>
        <label>密钥{saved?.hasApiKey ? `（已配置 ${saved.apiKeyPreview}，留空不修改）` : '（未配置）'}<input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={saved?.hasApiKey ? '留空 = 不修改' : 'sk-...'} autoComplete="off" /></label>
      </div>
      <p className="muted">密钥只存服务器数据库（data/ 目录，已忽略不进 Git），不会发给除网关外的任何地方。</p>
      <div className="result-actions"><button className="primary-btn" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存到数据库'}</button><button className="secondary-btn" disabled={testing} onClick={refreshModels}>{testing ? '拉取中…' : '刷新模型列表'}</button><button className="secondary-btn" disabled={probing} onClick={probe}>{probing ? '探测中…' : '🔍 自动找可用模型'}</button><button className="secondary-btn" onClick={resetAll}>恢复默认</button></div>
    </div>
  </div></section>;
}

export default App;
