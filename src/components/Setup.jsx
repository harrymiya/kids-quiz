// 页面：冒险准备（学科 / 难度 / 题量 / 档案）
import { useState } from 'react';
import { api } from '../api';
import { GRADES, difficulties, subjects } from '../questions';

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

export default Setup;
