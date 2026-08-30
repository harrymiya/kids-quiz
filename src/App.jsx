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
    if (newAdventure) { setBestStreak(0); setStars(0); }
    setMessage(encouragement[Math.floor(Math.random() * encouragement.length)]); setAnswerState(null); setScreen('game'); audio.prompt();
  };
  const newRun = () => { setLevel(1); setActiveRelics([]); startLevel(1, { newAdventure: true, nextLives: 3 }); };
  const answer = (value) => {
    if (answerState || !q) return;
    const isCorrect = String(value) === String(q.answer); setAnswerState({ value, isCorrect });
    const nextStreak = isCorrect ? streak + 1 : 0;
    if (isCorrect) { setCorrect((n) => n + 1); setStars((n) => n + 1); setStreak(nextStreak); setBestStreak((n) => Math.max(n, nextStreak)); setMessage(praise[Math.floor(Math.random() * praise.length)]); audio.correct(); }
    else { setLives((n) => n - 1); setStreak(0); setMessage(lives > 1 ? '别灰心，生命还在，继续探险！' : '生命用完了，回到营地休息一下吧！'); audio.wrong(); }
    if (profile) fetch(`${API}/attempts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: profile.id, questionId: q.id, subjectId: subject.id, correct: isCorrect }) }).catch(() => {});
    window.setTimeout(() => { if (!isCorrect && lives <= 1 || index + 1 >= questions.length) finish(isCorrect ? correct + 1 : correct, isCorrect ? lives : lives - 1); else { setIndex((n) => n + 1); setAnswerState(null); setMessage(encouragement[Math.floor(Math.random() * encouragement.length)]); } }, 850);
  };
  const finish = (score, remainingLives) => { const passed = remainingLives > 0 && score >= Math.ceil(questionCount * .6); setCorrect(score); setAnswerState(null); setMessage(passed ? '选择一个增益，继续深入知识岛。' : '带着经验回到营地，下一次一定走得更远。'); setSelectedRelic(null); setFireworks(passed); audio[passed ? 'fanfare' : 'sad'](); setScreen('result'); };
  const continueRun = () => {
    setFireworks(false);
    const passed = lives > 0 && correct >= Math.ceil(questionCount * .6);
    if (!passed || level >= 5) { newRun(); return; }
    if (selectedRelic) setActiveRelics((items) => [...items, selectedRelic]);
    const nextLevel = level + 1;
    const nextLives = Math.min(3, lives + (selectedRelic?.name === '勇气护盾' ? 1 : 0));
    setLevel(nextLevel); startLevel(nextLevel, { nextLives });
  };

  return <>
    <div className="sky-decor" aria-hidden="true"><span className="cloud cloud-a">☁</span><span className="cloud cloud-b">☁</span><span className="float-icon icon-a">✦</span><span className="float-icon icon-b">✿</span><span className="float-icon icon-c">★</span><span className="float-icon icon-d">✦</span></div>
    <header className="global-header"><button className="brand" onClick={() => go('start')} aria-label="返回首页"><span className="brand-mark">🐾</span><span>奇趣知识岛</span></button><button className="round-control" onClick={() => { const next = !muted; setMuted(next); audio.muted = next; }} aria-label="声音开关">{muted ? '🔇' : '🔊'}</button></header>
    {screen === 'start' && <section className="screen active"><div className="hero"><div className="hero-copy"><div className="eyebrow"><span>NEW</span> 每一次挑战都不一样</div><h1>登上知识岛<br /><em>玩着学，更聪明！</em></h1><p>6 大主题、3 档难度、4 种题量，数学计算、语言表达、自然科学和生活常识一次玩个够。</p><div className="hero-actions"><button className="primary-btn" onClick={() => go('setup')}>开始探险 <span>➜</span></button><div className="mini-proof"><b>300+</b><span>趣味题目组合</span></div></div></div><div className="island-scene"><div className="sun">☀</div><div className="orbit orbit-1">🎯</div><div className="orbit orbit-2">🧩</div><div className="orbit orbit-3">🎵</div><div className="mascot-card"><div className="mascot">🐶</div><div className="mascot-name">探险队长 · 威力</div></div><div className="island-base"><span>🌳</span><span>🏫</span><span>🌳</span></div></div></div></section>}
    {screen === 'setup' && <Setup subject={subject} setSubject={setSubject} difficulty={difficulty} setDifficulty={setDifficulty} questionCount={questionCount} setQuestionCount={setQuestionCount} profiles={profiles} profile={profile} setProfile={setProfile} refreshProfiles={refreshProfiles} title={title} memoryDue={memoryDue} onBack={() => go('start')} onStart={newRun} />}
    {screen === 'game' && q && <GameView q={q} index={index} questionCount={questionCount} level={level} subject={subject} lives={lives} streak={streak} stars={stars} answerState={answerState} message={message} onAnswer={answer} onBack={() => go('setup')} onRead={() => audio.speak(`${q.prompt}，${q.visual}，请选择正确答案`)} />}
    {screen === 'result' && <Result correct={correct} count={questionCount} level={level} lives={lives} bestStreak={bestStreak} passed={lives > 0 && correct >= Math.ceil(questionCount * .6)} selectedRelic={selectedRelic} setSelectedRelic={setSelectedRelic} onContinue={continueRun} onChange={() => go('setup')} />}
    <Fireworks active={fireworks} />
  </>;
}

function Setup({ subject, setSubject, difficulty, setDifficulty, questionCount, setQuestionCount, profiles, profile, setProfile, refreshProfiles, title, memoryDue, onBack, onStart }) {
  const [name, setName] = useState('');
  const addProfile = async () => { if (!name.trim()) return; const response = await fetch(`${API}/profiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) }); const created = await response.json(); setName(''); setProfile(created); refreshProfiles(); };
  return <section className="screen active"><div className="setup-shell"><div className="section-heading"><button className="icon-btn" onClick={onBack}>←</button><div><span className="section-kicker">冒险准备</span><h2>定制你的知识之旅</h2></div><div className="step-pill">3 步出发</div></div><div className="setup-block profile-block"><div className="block-title"><span>👤</span><div><h3>个人档案</h3><p>记忆曲线会为每位小探险家独立记录</p></div></div><div className="profile-controls"><select value={profile?.id || ''} onChange={(event) => setProfile(profiles.find((item) => item.id === Number(event.target.value)))}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.avatar} {item.name}</option>)}</select><input value={name} onChange={(event) => setName(event.target.value)} placeholder="新建昵称" maxLength="20" /><button className="secondary-btn" onClick={addProfile}>添加档案</button><span className="memory-note">📚 待复习 {memoryDue.length} 题</span></div></div><div className="setup-block"><div className="block-title"><span>1</span><div><h3>选择一座主题岛</h3><p>题库会优先安排到期复习题</p></div></div><div className="subject-grid">{subjects.map((item) => <button key={item.id} className={`subject-card ${subject.id === item.id ? 'selected' : ''}`} style={{ '--subject-color': item.color }} onClick={() => setSubject(item)}><span className="emoji">{item.emoji}</span><div className="name">{item.name}</div><div className="desc">{item.desc}</div></button>)}</div></div><div className="setup-row"><div className="setup-block compact"><div className="block-title"><span>2</span><div><h3>挑战难度</h3><p>{difficulties.find((item) => item.value === difficulty)?.tip}</p></div></div><div className="segmented difficulty-choice">{difficulties.map((item) => <button key={item.value} className={`choice-btn ${difficulty === item.value ? 'selected' : ''}`} onClick={() => setDifficulty(item.value)}>{item.name}<small>{item.label}</small></button>)}</div></div><div className="setup-block compact"><div className="block-title"><span>3</span><div><h3>本层题量</h3><p>短练习或大挑战</p></div></div><div className="segmented count-choice">{[5, 8, 10, 12].map((count) => <button key={count} className={`choice-btn ${questionCount === count ? 'selected' : ''}`} onClick={() => setQuestionCount(count)}>{count}<small>道题</small></button>)}</div></div></div><div className="launch-bar"><div className="launch-summary"><span>{subject.emoji}</span><p><b>{subject.name}岛 · {title}</b><small>{questionCount} 道题，勇闯 5 层随机冒险</small></p></div><button className="primary-btn" onClick={onStart}>出发闯关 <span>🚀</span></button></div></div></section>;
}

function GameView({ q, index, questionCount, level, subject, lives, streak, stars, answerState, message, onAnswer, onBack, onRead }) {
  return <section className="screen active" id="screen-game"><div className="game-shell"><div className="game-topbar"><button className="icon-btn" onClick={onBack}>←</button><div className="game-identity"><span>{subject.emoji}</span><div><b>{subject.name}岛</b><small>第 {level} / 5 层 · 记忆复习优先</small></div></div><div className="game-stats"><div><span>❤️</span><b>{'❤️'.repeat(lives) || '0'}</b><small>生命</small></div><div><span>🔥</span><b>{streak}</b><small>连对</small></div><div><span>⭐</span><b>{stars}</b><small>星星</small></div></div></div><div className="progress-area"><div className="progress-meta"><span>第 {index + 1} / {questionCount} 题</span><span>{Math.round(index / questionCount * 100)}%</span></div><div className="progress-track"><div id="progress-fill" style={{ width: `${index / questionCount * 100}%` }} /><span id="progress-dog" style={{ left: `${index / questionCount * 100}%` }}>🐾</span></div></div><div className="game-content"><aside className="coach-card"><div className="coach-mascot">🐶</div><div className="coach-bubble">{message}</div></aside><div className="quiz-column"><article className="question-card"><div className="question-header"><span className="type-tag">{q.type}</span><button className="read-btn" onClick={onRead}>🔈 读题</button></div><h2>{q.prompt}</h2><div className="question-extra"><div className="visual-word">{q.visual}</div></div><p className="question-hint">选出你认为正确的答案</p></article><div className="answers">{q.options.map((option, i) => <button key={`${q.id}-${option}`} className={`answer ${answerState?.value === option ? (answerState.isCorrect ? 'correct' : 'wrong') : ''} ${answerState ? 'disabled' : ''}`} onClick={() => onAnswer(option)}><span className="option-key">{String.fromCharCode(65 + i)}</span>{option}</button>)}</div></div></div></div></section>;
}

function Result({ correct, count, level, lives, bestStreak, passed, selectedRelic, setSelectedRelic, onContinue, onChange }) {
  const options = useMemo(() => shuffle(relics).slice(0, 3), []);
  return <section className="screen active" id="screen-result"><div className="result-shell"><div className="result-badge">{passed ? '🏆' : '🧭'}</div><span className="section-kicker">探险报告</span><h2>{passed ? (level >= 5 ? '知识岛通关成功！' : `第 ${level} 层通过！`) : '冒险暂时结束'}</h2><p>{passed ? '选择一个随机增益，继续深入知识岛。' : '带着经验回到营地，下一次一定走得更远。'}</p><div className="result-stars">{'⭐'.repeat(correct)}{'☆'.repeat(count - correct)}</div><div className="result-stats"><div><span className="stat-icon mint">✓</span><p><b>{correct}/{count}</b><small>答对题目</small></p></div><div><span className="stat-icon yellow">◎</span><p><b>{Math.round(correct / count * 100)}%</b><small>正确率</small></p></div><div><span className="stat-icon pink">🔥</span><p><b>{bestStreak}</b><small>最高连对</small></p></div></div>{passed && level < 5 && <div className="relic-choice">{options.map((item) => <button key={item.name} className={`relic-card ${selectedRelic?.name === item.name ? 'selected' : ''}`} onClick={() => setSelectedRelic(item)}><strong>{item.icon}</strong><b>{item.name}</b><small>{item.desc}</small></button>)}</div>}<div className="result-actions"><button className="primary-btn" disabled={passed && level < 5 && !selectedRelic} onClick={onContinue}>{passed && level < 5 ? '选择增益后继续 ➜' : '重新挑战 🔄'}</button><button className="secondary-btn" onClick={onChange}>更换设置</button></div></div></section>;
}

export default App;
