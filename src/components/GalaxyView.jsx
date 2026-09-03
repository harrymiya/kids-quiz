// 页面：知识星图（每个知识点是一个点，掌握即点亮；只读当前档案）
import { useState } from 'react';
import { GRADES, KNOWLEDGE, isUnitId, subjects } from '../questions';
import { VideoBtn, subjectOf } from './bits';

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

export default GalaxyView;
