// 页面：错题本（归集 / 筛选 / 重练 / 毕业）
import { useState } from 'react';
import { knowledgeName, subjects } from '../questions';
import { VideoBtn, subjectOf } from './bits';

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

export default MistakesView;
