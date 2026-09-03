// 网关层：大模型配置解析 / 调用 / 故障转移 / 可用探测（OpenAI 兼容协议，模型不写死）
import { getSetting } from './db.js';

// 只从配置读取，优先级：设置页（数据库）> 环境变量；网关地址/密钥最后回退内置，模型无默认值
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://codex.xyingsoft.com/v1';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || '';
const LLM_FALLBACKS_DEFAULT = process.env.LLM_FALLBACKS || '';

export const resolveLLM = () => {
  const baseUrl = (getSetting('llm_base_url') || LLM_BASE_URL).replace(/\/$/, '');
  const apiKey = getSetting('llm_api_key') || LLM_API_KEY;
  const model = getSetting('llm_model') || LLM_MODEL;
  const fallbacks = (getSetting('llm_fallbacks') || LLM_FALLBACKS_DEFAULT).split(',').map((s) => s.trim()).filter(Boolean);
  return { baseUrl, apiKey, model, fallbacks };
};

// 网关按“模型×分组”动态分配上游通道，单个模型可能暂时无通道；只在已配置候选中转移
export const RETRYABLE = /no available channel|temporarily unavailable|model_not_found|overload|rate.?limit|timeout|timed out|aborted|502|503|529/i;
export const FATAL = /invalid.*(key|token)|unauthorized|incorrect api key|余额不足|insufficient/i;
// 明显不是文字对话模型的，按通用关键字过滤（动态发现时使用，不写死具体模型名）
const NON_CHAT_MODEL = /image|video|imagine|tts|whisper|embedding|moderation|audio|dall-e|stable/i;
export const isChatModel = (id) => !NON_CHAT_MODEL.test(String(id));

export const friendlyError = (message) => {
  if (!message) return '大模型服务异常';
  if (/尚未配置模型/.test(message)) return message;
  if (/no available channel/i.test(message)) return '所选模型当前没有可用通道，可到设置页换个模型或点🔍自动探测';
  if (/temporarily unavailable/i.test(message)) return '网关服务暂时不可用，稍后再试';
  if (/余额不足|insufficient/i.test(message)) return '密钥余额不足，请充值或更换密钥';
  if (FATAL.test(message)) return '密钥无效或未授权，请检查密钥';
  return message;
};

export async function completeOnce({ baseUrl, apiKey, model }, messages, { temperature = 0.7, maxTokens = 800, timeout = 60000 } = {}) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error.message || `大模型服务异常(${res.status})`);
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('大模型返回为空');
  return { reply, model: data.model || model };
}

export async function chatCompletion(config, messages, options = {}) {
  const candidates = [...new Set([config.model, ...(config.fallbacks || [])].filter(Boolean))];
  if (!candidates.length) throw new Error('尚未配置模型：请到“设置”页选择并保存模型（可用🔍自动探测）');
  let lastError = null;
  for (const model of candidates) {
    try {
      const result = await completeOnce({ ...config, model }, messages, options);
      return { ...result, requestedModel: config.model };
    } catch (error) {
      lastError = error;
      if (FATAL.test(error.message)) break; // key/余额问题：换模型也没用，直接报错
      if (!RETRYABLE.test(error.message)) break; // 未知错误：不盲目重试
    }
  }
  throw new Error(friendlyError(lastError?.message || '大模型服务异常'));
}

export async function fetchModels(config, timeout = 30000) {
  const res = await fetch(`${config.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    signal: AbortSignal.timeout(timeout),
  });
  const data = await res.json();
  return (data.data || []).map((m) => m.id).sort();
}
