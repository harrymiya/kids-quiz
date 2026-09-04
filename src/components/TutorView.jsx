// 页面：AI 老师语音对话（文字 + speech to speech 连续对话）
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { listenOnce, speak, speakAndWait, speechSupported, stopListen, stopSpeak, ttsSupported } from '../voice';

function TutorView({ profile, subject, profiles, mistakes, msgs, setMsgs, pendingAsk, clearPendingAsk, flash, onAgentAction }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const [tools, setTools] = useState([]);
  const bottomRef = useRef(null);
  const accuracy = profile?.attempts ? Math.round((profile.correct_answers / profile.attempts) * 100) : null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => () => { voiceModeRef.current = false; stopListen(); stopSpeak(); }, []);

  useEffect(() => {
    if (profile?.id) api.learningTools(profile.id).then(setTools).catch(() => setTools([]));
  }, [profile?.id]);

  const context = () => ({
    profileName: profile?.name, grade: profile?.grade || '一年级', subjectId: subject?.id,
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
      const data = profile?.id
        ? await api.aiAgent(profile.id, next.slice(-12), context())
        : await api.aiChat(next.slice(-12), context());
      if (data.steps?.some((step) => step.tool === 'create_learning_tool')) {
        api.learningTools(profile.id).then(setTools).catch(() => {});
      }
      setMsgs((list) => [...list, { role: 'assistant', content: data.reply, model: data.model, steps: data.steps }]);
      (data.actions || []).forEach((action) => onAgentAction?.(action));
      if (autoSpeak || spoken || voiceModeRef.current) {
        if (voiceModeRef.current) await speakAndWait(data.reply);
        else speak(data.reply);
      }
      if (voiceModeRef.current) {
        window.setTimeout(() => voiceLoop(), 250);
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
      if (voiceModeRef.current && e.code === 'no-speech') {
        flash('没有听到声音，请对着麦克风再说一次');
        window.setTimeout(() => voiceLoop(), 450);
      } else if (voiceModeRef.current) {
        flash(e.message);
        voiceModeRef.current = false; setVoiceMode(false);
      }
    }
  };
  const toggleVoice = () => {
    if (voiceModeRef.current) { voiceModeRef.current = false; setVoiceMode(false); stopListen(); stopSpeak(); return; }
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

  const chips = ['安排今天的学习', '开始到期复习', '诊断我的错题', `考考我的${subject?.name}`, '教我一个记忆小窍门'];
  const chipSend = (chip) => {
    if (chip === '诊断我的错题') {
      const open = (mistakes || []).filter((m) => !m.mastered).slice(0, 3);
      send(open.length ? `这是我最近的错题：${open.map((m) => `${m.prompt}（答案${m.answer}，我选了${m.picked}）`).join('；')}。请挑最关键的一道讲一讲。` : '我最近没有错题，请夸夸我并出一道挑战题。');
    } else send(chip);
  };

  return <section className="screen active"><div className="panel-shell tutor-shell"><div className="section-heading"><div><span className="section-kicker">🎙️ AI老师 · 语音对话</span><h2>跟威威老师说话吧</h2><p className="muted">{profile?.name} · {profile?.grade} · {speechSupported() ? '支持语音对话' : '当前浏览器仅支持文字+朗读'} · {ttsSupported() ? '支持语音播报' : ''}</p></div><div className="tutor-toggles"><button className={`chip ${autoSpeak ? 'selected' : ''}`} onClick={() => { setAutoSpeak(!autoSpeak); if (autoSpeak) stopSpeak(); }}>🔈 自动播报</button><button className={`chip ${voiceMode ? 'selected' : ''}`} onClick={toggleVoice}>{voiceMode ? '⏹ 结束对话' : '🎙️ 连续对话'}</button></div></div>
    <div className="chat-list">{msgs.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}><span className="chat-avatar">{m.role === 'assistant' ? '🐶' : (profile?.avatar || '🧒')}</span><div className="chat-bubble">{m.content}{m.role === 'assistant' && m.steps?.length > 0 && <small className="agent-trace">🔧 已调用 {m.steps.map((step) => step.tool).join('、')}</small>}{m.role === 'assistant' && <button className="mini-btn" onClick={() => speak(m.content)}>🔈</button>}</div></div>)}{busy && <div className="chat-msg assistant"><span className="chat-avatar">🐶</span><div className="chat-bubble typing">威威思考中…</div></div>}<div ref={bottomRef} /></div>
    <div className="chip-row">{chips.map((c) => <button key={c} className="chip" onClick={() => chipSend(c)}>{c}</button>)}<button className="chip" onClick={() => setInput('根据我的学情创建一个记忆工具')}>🧰 创建学习工具</button></div>
    {tools.length > 0 && <div className="learning-tools"><b>🧰 我的学习工具</b>{tools.slice(0, 4).map((tool) => <button key={tool.id} title={tool.payload?.goal || ''} onClick={() => send(`请使用学习工具“${tool.name}”带我练习，先读取工具内容，再一次给我一个任务。`)}>{tool.name}</button>)}</div>}
    <div className="chat-input-row"><button className={`mic-btn ${listening ? 'listening' : ''}`} onClick={micOnce} aria-label="语音输入">{listening ? '👂…' : '🎤'}</button><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(input)} placeholder={listening ? '正在听你说话…' : '打字或按话筒说话…'} maxLength="500" /><button className="primary-btn" disabled={busy || !input.trim()} onClick={() => send(input)}>发送</button></div>
  </div></section>;
}

export default TutorView;
