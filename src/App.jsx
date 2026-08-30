import { useEffect, useMemo, useState } from 'react';
import { audio } from './audio';
import Fireworks from './Fireworks';
import { buildQuestions, difficulties, relics, shuffle, subjects } from './questions';

const API = '/api';
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
  const [level, setLevel] = useState(1);
  const [questions, setQuestions] = useState([]);
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

  const refreshProfiles = () => fetch(`${API}/profiles`).then((r) => r.json()).then((data) => { setProfiles(data); if (!profile) setProfile(data[0]); }).catch(() => {});
  useEffect(() => { refreshProfiles(); }, []);
  useEffect(() => { if (profile) fetch(`${API}/reviews/due?profileId=${profile.id}&subjectId=${subject.id}`).then((r) => r.json()).then(setMemoryDue).catch(() => setMemoryDue([])); }, [profile, subject]);

  const title = useMemo(() => difficulties.find((item) => item.value === difficulty)?.name || '热身', [difficulty]);
  const q = questions[index];
  const go = (next) => { audio.init(); setFireworks(false); setScreen(next); };
  const startLevel = (runLevel, { newAdventure = false, nextLives = lives } = {}) => {
    audio.init(); audio.click();
    const created = buildQuestions(subject.id, runLevel + difficulty - 1, questionCount, memoryDue.map((item) => item.questionId));
    setQuestions(created); setIndex(0); setCorrect(0); setLives(newAdventure ? 3 : nextLives); setStreak(0);
    setPassiveState({}); setHiddenOptions([]); setRevealedAnswer(false); setArmedEffects({});
    if (newAdventure) { setBestStreak(0); setStars(0); setRelicUses({}); }
    setMessage(encouragement[Math.floor(Math.random() * encouragement.length)]); setAnswerState(null); setScreen('game'); audio.prompt();
  };
  const newRun = () => { setLevel(1); setActiveRelics([]); startLevel(1, { newAdventure: true, nextLives: 3 }); };
  const hasRelic = (id) => activeRelics.some((item) => item.id === id);
  const useRelic = (relic) => {
    if (answerState || relic.type !== 'active' || (relicUses[relic.id] || 0) <= 0) return;
    let used = true;
    let nextMessage = '';
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
    setMessage(nextMessage);
    audio.click();
  };
  const answer = (value) => {
    if (answerState || !q) return;
    const isCorrect = String(value) === String(q.answer); setAnswerState({ value, isCorrect });
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
      setMessage(triggered.length ? `${triggered.join('、')}触发！这题获得 ${earnedStars} 颗星！` : praise[Math.floor(Math.random() * praise.length)]);
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
      setMessage(protectedLife ? `${triggered[0]}保护了你，没有扣生命！` : (nextLives > 0 ? '别灰心，生命还在，继续探险！' : '生命用完了，回到营地休息一下吧！'));
      audio.wrong();
    }
    if (profile) fetch(`${API}/attempts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: profile.id, questionId: q.id, subjectId: subject.id, correct: isCorrect }) }).catch(() => {});
    const nextCorrect = isCorrect ? correct + 1 : correct;
    window.setTimeout(() => {
      if (nextLives <= 0 || index + 1 >= questions.length) finish(nextCorrect, nextLives);
      else { setIndex((n) => n + 1); setAnswerState(null); setHiddenOptions([]); setRevealedAnswer(false); setMessage(encouragement[Math.floor(Math.random() * encouragement.length)]); }
    }, 850);
  };
  const finish = (score, remainingLives) => { const passed = remainingLives > 0 && score >= Math.ceil(questionCount * .6); setCorrect(score); setAnswerState(null); setMessage(passed ? '选择一个增益，继续深入知识岛。' : '带着经验回到营地，下一次一定走得更远。'); setSelectedRelic(null); setFireworks(passed); audio[passed ? 'fanfare' : 'sad'](); setScreen('result'); };
  const continueRun = () => {
    setFireworks(false);
    const passed = lives > 0 && correct >= Math.ceil(questionCount * .6);
    if (!passed || level >= 5) { newRun(); return; }
    if (selectedRelic) {
      setActiveRelics((items) => [...items, selectedRelic]);
      if (selectedRelic.type === 'active') setRelicUses((state) => ({ ...state, [selectedRelic.id]: selectedRelic.uses }));
    }
    const nextLevel = level + 1;
    const nextLives = Math.min(4, lives);
    setLevel(nextLevel); startLevel(nextLevel, { nextLives });
  };

  return <>
    <div className="sky-decor" aria-hidden="true"><span className="cloud cloud-a">☁</span><span className="cloud cloud-b">☁</span><span className="float-icon icon-a">✦</span><span className="float-icon icon-b">✿</span><span className="float-icon icon-c">★</span><span className="float-icon icon-d">✦</span></div>
    <header className="global-header"><button className="brand" onClick={() => go('start')} aria-label="返回首页"><span className="brand-mark">🐾</span><span>奇趣知识岛</span></button><button className="round-control" onClick={() => { const next = !muted; setMuted(next); audio.muted = next; }} aria-label="声音开关">{muted ? '🔇' : '🔊'}</button></header>
    {screen === 'start' && <section className="screen active"><div className="hero"><div className="hero-copy"><div className="eyebrow"><span>NEW</span> 每一次挑战都不一样</div><h1>登上知识岛<br /><em>玩着学，更聪明！</em></h1><p>6 大主题、3 档难度、4 种题量，数学计算、语言表达、自然科学和生活常识一次玩个够。</p><div className="hero-actions"><button className="primary-btn" onClick={() => go('setup')}>开始探险 <span>➜</span></button><div className="mini-proof"><b>300+</b><span>趣味题目组合</span></div></div></div><div className="island-scene"><div className="sun">☀</div><div className="orbit orbit-1">🎯</div><div className="orbit orbit-2">🧩</div><div className="orbit orbit-3">🎵</div><div className="mascot-card"><div className="mascot">🐶</div><div className="mascot-name">探险队长 · 威力</div></div><div className="island-base"><span>🌳</span><span>🏫</span><span>🌳</span></div></div></div></section>}
    {screen === 'setup' && <Setup subject={subject} setSubject={setSubject} difficulty={difficulty} setDifficulty={setDifficulty} questionCount={questionCount} setQuestionCount={setQuestionCount} profiles={profiles} profile={profile} setProfile={setProfile} refreshProfiles={refreshProfiles} title={title} memoryDue={memoryDue} onBack={() => go('start')} onStart={newRun} />}
    {screen === 'game' && q && <GameView q={q} index={index} questionCount={questionCount} level={level} subject={subject} lives={lives} streak={streak} stars={stars} answerState={answerState} message={message} activeRelics={activeRelics} relicUses={relicUses} passiveState={passiveState} armedEffects={armedEffects} hiddenOptions={hiddenOptions} revealedAnswer={revealedAnswer} onUseRelic={useRelic} onAnswer={answer} onBack={() => go('setup')} onRead={() => audio.speak(`${q.prompt}，${q.visual}，请选择正确答案`)} />}
    {screen === 'result' && <Result correct={correct} count={questionCount} level={level} lives={lives} bestStreak={bestStreak} passed={lives > 0 && correct >= Math.ceil(questionCount * .6)} selectedRelic={selectedRelic} setSelectedRelic={setSelectedRelic} activeRelics={activeRelics} onContinue={continueRun} onChange={() => go('setup')} />}
    <Fireworks active={fireworks} />
  </>;
}

function Setup({ subject, setSubject, difficulty, setDifficulty, questionCount, setQuestionCount, profiles, profile, setProfile, refreshProfiles, title, memoryDue, onBack, onStart }) {
  const [name, setName] = useState('');
  const addProfile = async () => { if (!name.trim()) return; const response = await fetch(`${API}/profiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) }); const created = await response.json(); setName(''); setProfile(created); refreshProfiles(); };
  return <section className="screen active"><div className="setup-shell"><div className="section-heading"><button className="icon-btn" onClick={onBack}>←</button><div><span className="section-kicker">冒险准备</span><h2>定制你的知识之旅</h2></div><div className="step-pill">3 步出发</div></div><div className="setup-block profile-block"><div className="block-title"><span>👤</span><div><h3>个人档案</h3><p>记忆曲线会为每位小探险家独立记录</p></div></div><div className="profile-controls"><select value={profile?.id || ''} onChange={(event) => setProfile(profiles.find((item) => item.id === Number(event.target.value)))}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.avatar} {item.name}</option>)}</select><input value={name} onChange={(event) => setName(event.target.value)} placeholder="新建昵称" maxLength="20" /><button className="secondary-btn" onClick={addProfile}>添加档案</button><span className="memory-note">📚 待复习 {memoryDue.length} 题</span></div></div><div className="setup-block"><div className="block-title"><span>1</span><div><h3>选择一座主题岛</h3><p>题库会优先安排到期复习题</p></div></div><div className="subject-grid">{subjects.map((item) => <button key={item.id} className={`subject-card ${subject.id === item.id ? 'selected' : ''}`} style={{ '--subject-color': item.color }} onClick={() => setSubject(item)}><span className="emoji">{item.emoji}</span><div className="name">{item.name}</div><div className="desc">{item.desc}</div></button>)}</div></div><div className="setup-row"><div className="setup-block compact"><div className="block-title"><span>2</span><div><h3>挑战难度</h3><p>{difficulties.find((item) => item.value === difficulty)?.tip}</p></div></div><div className="segmented difficulty-choice">{difficulties.map((item) => <button key={item.value} className={`choice-btn ${difficulty === item.value ? 'selected' : ''}`} onClick={() => setDifficulty(item.value)}>{item.name}<small>{item.label}</small></button>)}</div></div><div className="setup-block compact"><div className="block-title"><span>3</span><div><h3>本层题量</h3><p>短练习或大挑战</p></div></div><div className="segmented count-choice">{[5, 8, 10, 12].map((count) => <button key={count} className={`choice-btn ${questionCount === count ? 'selected' : ''}`} onClick={() => setQuestionCount(count)}>{count}<small>道题</small></button>)}</div></div></div><div className="launch-bar"><div className="launch-summary"><span>{subject.emoji}</span><p><b>{subject.name}岛 · {title}</b><small>{questionCount} 道题，勇闯 5 层随机冒险</small></p></div><button className="primary-btn" onClick={onStart}>出发闯关 <span>🚀</span></button></div></div></section>;
}

function GameView({ q, index, questionCount, level, subject, lives, streak, stars, answerState, message, activeRelics, relicUses, passiveState, armedEffects, hiddenOptions, revealedAnswer, onUseRelic, onAnswer, onBack, onRead }) {
  return <section className={`screen active ${answerState?.isCorrect ? 'correct-hit' : ''}`} id="screen-game"><div className="game-shell"><div className="game-topbar"><button className="icon-btn" onClick={onBack}>←</button><div className="game-identity"><span>{subject.emoji}</span><div><b>{subject.name}岛</b><small>第 {level} / 5 层 · 记忆复习优先</small></div></div><div className="game-stats"><div><span>❤️</span><b>{'❤️'.repeat(lives) || '0'}</b><small>生命</small></div><div><span>🔥</span><b>{streak}</b><small>连对</small></div><div><span>⭐</span><b>{stars}</b><small>星星</small></div></div></div><div className="progress-area"><div className="progress-meta"><span>第 {index + 1} / {questionCount} 题</span><span>{Math.round(index / questionCount * 100)}%</span></div><div className="progress-track"><div id="progress-fill" style={{ width: `${index / questionCount * 100}%` }} /><span id="progress-dog" style={{ left: `${index / questionCount * 100}%` }}>🐾</span></div></div><div className="game-content"><aside className="coach-card"><div className={`coach-mascot ${answerState?.isCorrect ? 'happy' : ''}`}>🐶</div><div className="coach-bubble">{message}</div><RelicInventory relics={activeRelics} relicUses={relicUses} passiveState={passiveState} armedEffects={armedEffects} lives={lives} streak={streak} index={index} questionCount={questionCount} answerState={answerState} hiddenOptions={hiddenOptions} revealedAnswer={revealedAnswer} onUse={onUseRelic} /></aside><div className="quiz-column">{answerState?.isCorrect && <CorrectEffect key={`${q.id}-${index}`} streak={streak} earnedStars={answerState.earnedStars} />}<article className="question-card"><div className="question-header"><span className="type-tag">{q.type}</span><button className="read-btn" onClick={onRead}>🔈 读题</button></div><h2>{q.prompt}</h2><div className="question-extra"><div className="visual-word">{q.visual}</div></div><p className="question-hint">{revealedAnswer ? '水晶正在提示正确答案' : '选出你认为正确的答案'}</p></article><div className="answers">{q.options.map((option, i) => { const hidden = hiddenOptions.some((item) => String(item) === String(option)); const revealed = revealedAnswer && String(option) === String(q.answer); return <button key={`${q.id}-${option}`} disabled={hidden} className={`answer ${answerState?.value === option ? (answerState.isCorrect ? 'correct' : 'wrong') : ''} ${answerState ? 'disabled' : ''} ${hidden ? 'eliminated' : ''} ${revealed ? 'revealed' : ''}`} onClick={() => onAnswer(option)}><span className="option-key">{String.fromCharCode(65 + i)}</span>{hidden ? '已排除' : option}</button>; })}</div></div></div></div></section>;
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

function Result({ correct, count, level, lives, bestStreak, passed, selectedRelic, setSelectedRelic, activeRelics, onContinue, onChange }) {
  const ownedIds = activeRelics.map((item) => item.id).join(',');
  const options = useMemo(() => shuffle(relics.filter((item) => !ownedIds.split(',').includes(item.id))).slice(0, 3), [ownedIds]);
  return <section className="screen active" id="screen-result"><div className="result-shell"><div className="result-badge">{passed ? '🏆' : '🧭'}</div><span className="section-kicker">探险报告</span><h2>{passed ? (level >= 5 ? '知识岛通关成功！' : `第 ${level} 层通过！`) : '冒险暂时结束'}</h2><p>{passed ? '选择一个随机增益，继续深入知识岛。' : '带着经验回到营地，下一次一定走得更远。'}</p><div className="result-stars">{'⭐'.repeat(correct)}{'☆'.repeat(count - correct)}</div><div className="result-stats"><div><span className="stat-icon mint">✓</span><p><b>{correct}/{count}</b><small>答对题目</small></p></div><div><span className="stat-icon yellow">◎</span><p><b>{Math.round(correct / count * 100)}%</b><small>正确率</small></p></div><div><span className="stat-icon pink">🔥</span><p><b>{bestStreak}</b><small>最高连对</small></p></div></div>{passed && level < 5 && <div className="relic-choice">{options.map((item) => <button key={item.name} className={`relic-card ${selectedRelic?.name === item.name ? 'selected' : ''}`} onClick={() => setSelectedRelic(item)}><span className={`relic-type ${item.type}`}>{item.type === 'active' ? '主动 · 可点击' : '被动 · 自动触发'}</span><strong>{item.icon}</strong><b>{item.name}</b><small>{item.desc}</small></button>)}</div>}<div className="result-actions"><button className="primary-btn" disabled={passed && level < 5 && !selectedRelic} onClick={onContinue}>{passed && level < 5 ? '选择增益后继续 ➜' : '重新挑战 🔄'}</button><button className="secondary-btn" onClick={onChange}>更换设置</button></div></div></section>;
}

export default App;
