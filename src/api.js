// 后端 API 客户端。大模型配置存数据库（设置页），前端不再自带密钥/模型。
const API = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败(${res.status})`);
  return data;
}

export const api = {
  profiles: () => request('/profiles'),
  createProfile: (body) => request('/profiles', { method: 'POST', body: JSON.stringify(body) }),
  updateProfile: (id, body) => request(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  dueReviews: (profileId, subjectId) => request(`/reviews/due?profileId=${profileId}&subjectId=${subjectId}`),
  intervention: (body) => request('/learning/intervention', { method: 'POST', body: JSON.stringify(body) }),
  saveAttempt: (body) => request('/attempts', { method: 'POST', body: JSON.stringify(body) }),
  mistakes: (profileId, subjectId, mastered) => {
    let q = `/mistakes?profileId=${profileId}`;
    if (subjectId) q += `&subjectId=${subjectId}`;
    if (mastered !== undefined) q += `&mastered=${mastered}`;
    return request(q);
  },
  markMastered: (id, mastered = true) => request(`/mistakes/${id}/mastered`, { method: 'POST', body: JSON.stringify({ mastered }) }),
  mastery: (profileId) => request(`/profiles/${profileId}/mastery`),
  sessions: (profileId) => request(`/sessions?profileId=${profileId}`),
  saveSession: (body) => request('/sessions', { method: 'POST', body: JSON.stringify(body) }),
  activity: (profileId) => request(`/profiles/${profileId}/activity`),
  curriculum: () => request('/curriculum'),
  config: () => request('/config'),
  models: () => request('/models'),
  modelsProbe: () => request('/models/probe', { method: 'POST', body: '{}' }),
  getSettings: () => request('/settings'),
  saveSettings: (body) => request('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  resetSettings: () => request('/settings', { method: 'DELETE' }),
  aiAgent: (profileId, messages, context) => request('/ai/agent', { method: 'POST', body: JSON.stringify({ profileId, messages, context }) }),
  learningTools: (profileId) => request(`/learning-tools?profileId=${profileId}`),
  deleteLearningTool: (profileId, id) => request(`/learning-tools/${id}`, { method: 'DELETE', body: JSON.stringify({ profileId }) }),
  aiChat: (messages, context) => request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, context }) }),
  aiAnalyze: (profileId) => request('/ai/analyze', { method: 'POST', body: JSON.stringify({ profileId }) }),
  aiQuestions: (profileId, subjectId, count, focus) => request('/ai/questions', { method: 'POST', body: JSON.stringify({ profileId, subjectId, count, focus }) }),
};
