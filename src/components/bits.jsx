// 共享小件：跨页面复用的展示组件与小工具（无业务状态）
import { subjects } from '../questions.js';

export const subjectOf = (id) => subjects.find((s) => s.id === id) || subjects[0];

// 视频讲解：B站站内搜索直达（免 key、免审核，点开即看；自动嵌入需要平台审核与 key，故用搜索直达）
export const videoUrl = (grade, unitName) =>
  `https://search.bilibili.com/all?keyword=${encodeURIComponent(`小学${grade || ''} ${unitName} 讲解`.trim())}`;
export function VideoBtn({ grade, unit, small }) {
  if (!unit || unit === '综合') return null;
  return <a className={`video-btn${small ? ' small' : ''}`} href={videoUrl(grade, unit)} target="_blank" rel="noreferrer" title="去B站看视频讲解">🎬 视频讲解</a>;
}

// 图形题 SVG：多边形顶点数数 / 钟表（只显示题干时刻，不剧透答案）
export function VisualSVG({ spec }) {
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

export function CorrectEffect({ streak, earnedStars = 1 }) {
  const pieces = ['⭐', '✦', '●', '◆', '★', '✿', '●', '✦', '⭐', '◆', '★', '✿', '●', '★', '◆', '✦', '⭐', '●', '✿', '◆', '★', '✦', '●', '⭐'];
  return <div className="correct-effect" aria-live="polite"><div className="correct-flash" aria-hidden="true" /><div className="correct-rings" aria-hidden="true" /><div className="correct-pop"><span>✓</span><b>{streak > 1 ? `完美连击 × ${streak}` : '漂亮！答对啦'}</b><small>+{earnedStars} ⭐</small></div>{pieces.map((piece, index) => { const angle = index / pieces.length * Math.PI * 2; const distance = 150 + index % 4 * 32; return <i key={index} aria-hidden="true" style={{ '--x': `${Math.cos(angle) * distance}px`, '--y': `${Math.sin(angle) * distance}px`, '--spin': `${index % 2 ? 240 : -240}deg`, '--delay': `${index % 5 * 12}ms` }}>{piece}</i>; })}</div>;
}

export function RelicInventory({ relics: ownedRelics, relicUses, passiveState, armedEffects, lives, streak, index, questionCount, answerState, hiddenOptions, revealedAnswer, onUse }) {
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

// 本地成就（满分学霸等），存浏览器
export const getAchv = () => { try { return JSON.parse(localStorage.getItem('kids-quiz-achv') || '{}'); } catch { return {}; } };
export const addAchv = (key) => { const a = getAchv(); a[key] = (a[key] || 0) + 1; localStorage.setItem('kids-quiz-achv', JSON.stringify(a)); return a; };
