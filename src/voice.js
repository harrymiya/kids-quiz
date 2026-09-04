// speech to speech:浏览器语音识别(STT)+ 语音合成(TTS),与 AI 老师实时语音对话
// Chrome/Edge 支持 SpeechRecognition;Safari 部分支持;不支持时自动降级为文字+朗读

let activeRecognition = null;

const speechError = (code) => {
  const messages = {
    'not-allowed': '麦克风权限被拒绝，请在浏览器地址栏允许麦克风',
    'service-not-allowed': '浏览器禁止使用语音识别服务，请检查网站权限',
    'audio-capture': '没有检测到可用麦克风，请检查系统输入设备',
    network: '浏览器语音识别服务网络不可用，请检查网络后重试',
    'no-speech': '没有听到声音，请再说一次',
    aborted: '语音识别已停止',
  };
  const error = new Error(messages[code] || `语音识别失败：${code || '未知错误'}`);
  error.code = code || 'unknown';
  return error;
};

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

export function speakAndWait(text, options = {}) {
  if (!ttsSupported()) return Promise.resolve(false);
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 400));
    utterance.lang = options.lang || 'zh-CN';
    utterance.rate = options.rate || 0.95;
    utterance.pitch = options.pitch || 1.2;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const zh = voices.find((voice) => voice.lang?.startsWith('zh'));
    if (zh) utterance.voice = zh;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true; window.clearTimeout(timer); resolve(value);
    };
    const timer = window.setTimeout(() => finish(false), Math.min(30000, Math.max(5000, String(text).length * 220)));
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeak() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export function stopListen() {
  if (!activeRecognition) return;
  const recognition = activeRecognition;
  activeRecognition = null;
  try { recognition.abort(); } catch {}
}

// 一次性语音输入:返回识别出的文字,带超时保护
export function listenOnce({ lang = 'zh-CN', timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!speechSupported()) return reject(new Error('当前浏览器不支持语音输入,请用文字聊天'));
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    stopListen();
    const rec = new Rec();
    rec.lang = lang; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 1;
    activeRecognition = rec;
    let done = false;
    const finish = (handler) => {
      if (done) return false;
      done = true; clearTimeout(timer);
      if (activeRecognition === rec) activeRecognition = null;
      handler(); return true;
    };
    const timer = setTimeout(() => {
      finish(() => { try { rec.stop(); } catch {} reject(speechError('no-speech')); });
    }, timeout);
    rec.onresult = (event) => {
      const text = String(event.results?.[0]?.[0]?.transcript || '').trim();
      finish(() => text ? resolve(text) : reject(speechError('no-speech')));
    };
    rec.onerror = (event) => finish(() => reject(speechError(event.error)));
    rec.onnomatch = () => finish(() => reject(speechError('no-speech')));
    rec.onend = () => finish(() => reject(speechError('no-speech')));
    try { rec.start(); } catch (error) {
      finish(() => reject(speechError(error?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture')));
    }
  });
}
