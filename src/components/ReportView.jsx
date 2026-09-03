// 页面：AI 学情（分析报告 / 本周计划 / 学习路径 / 掌握度 / 闯关记录）
import { useState } from 'react';
import { KNOWLEDGE, isUnitId, knowledgeName, subjects, unitGrade } from '../questions';
import { VideoBtn, getAchv, subjectOf, videoUrl } from './bits';

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

export default ReportView;
