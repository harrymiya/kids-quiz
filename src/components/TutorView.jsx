// 页面：AI 老师语音对话（文字 + speech to speech 连续对话）
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { listenOnce, speak, speechSupported, stopSpeak, ttsSupported } from '../voice';

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

export default TutorView;
