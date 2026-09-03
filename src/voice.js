// speech to speech:浏览器语音识别(STT)+ 语音合成(TTS),与 AI 老师实时语音对话
// Chrome/Edge 支持 SpeechRecognition;Safari 部分支持;不支持时自动降级为文字+朗读

export const speechSupported = () =>
  typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

export const ttsSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text, { rate = 0.95, pitch = 1.2, lang = 'zh-CN' } = {}) {
  if (!ttsSupported()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 400));
  utterance.lang = lang; utterance.rate = rate; utterance.pitch = pitch;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const zh = voices.find((v) => v.lang?.startsWith('zh'));
  if (zh) utterance.voice = zh;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeak() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// 一次性语音输入:返回识别出的文字,带超时保护
export function listenOnce({ lang = 'zh-CN', timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!speechSupported()) return reject(new Error('当前浏览器不支持语音输入,请用文字聊天'));
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = lang; rec.interimResults = false; rec.maxAlternatives = 1;
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; try { rec.stop(); } catch {} reject(new Error('没听清,再说一次吧')); } }, timeout);
    rec.onresult = (event) => {
      if (done) return; done = true; clearTimeout(timer);
      resolve(event.results[0][0].transcript);
    };
    rec.onerror = (event) => { if (!done) { done = true; clearTimeout(timer); reject(new Error(`语音识别失败:${event.error}`)); } };
    rec.onend = () => { if (!done) { done = true; clearTimeout(timer); reject(new Error('没听清,再说一次吧')); } };
    try { rec.start(); } catch (e) { clearTimeout(timer); reject(e); }
  });
}
