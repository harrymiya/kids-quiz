// 页面：学习与 AI 设置（年级 / 网关 / 模型 / 密钥，均存服务器数据库）
import { useEffect, useState } from 'react';
import { api } from '../api';
import { GRADES } from '../questions';

function SettingsView({ profile, setProfile, refreshProfiles, flash }) {
  const [form, setForm] = useState({ baseUrl: '', apiKey: '', model: '', fallbacks: '' });
  const [saved, setSaved] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probing, setProbing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [grade, setGrade] = useState(profile?.grade || '一年级');
  useEffect(() => { setGrade(profile?.grade || '一年级'); }, [profile?.id]);
  useEffect(() => {
    api.getSettings()
      .then((data) => { setSaved(data); setForm((f) => ({ ...f, baseUrl: data.baseUrl || '', model: data.model || '', fallbacks: data.fallbacks || '' })); })
      .catch((e) => flash(e.message))
      .finally(() => setLoading(false));
    api.models().then((data) => setModels(data.models || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const saveGrade = async (g) => { setGrade(g); if (profile) { const updated = await api.updateProfile(profile.id, { grade: g }); setProfile(updated); refreshProfiles(); } };
  const save = async () => {
    setSaving(true);
    try {
      const data = await api.saveSettings({ baseUrl: form.baseUrl.trim(), apiKey: form.apiKey.trim(), model: form.model.trim(), fallbacks: form.fallbacks.trim() });
      setForm((f) => ({ ...f, apiKey: '' }));
      const refreshed = await api.getSettings();
      setSaved(refreshed);
      flash(data.model ? `已保存到数据库，当前模型：${data.model}` : '已保存到数据库（尚未选择模型，AI功能暂不可用）');
    } catch (e) { flash(e.message); } finally { setSaving(false); }
  };
  const refreshModels = async () => {
    setTesting(true);
    try {
      const data = await api.models();
      setModels(data.models || []);
      flash(`模型列表共 ${data.models?.length || 0} 个${data.currentModel ? `，当前已选：${data.currentModel}` : '，尚未选择模型'}`);
    } catch (e) { flash(e.message); } finally { setTesting(false); }
  };
  const probe = async () => {
    setProbing(true);
    try {
      const data = await api.modelsProbe();
      await api.saveSettings({ model: data.working });
      setForm((f) => ({ ...f, model: data.working }));
      const refreshed = await api.getSettings();
      setSaved(refreshed);
      flash(`找到可用模型 ${data.working}，已保存到数据库`);
    } catch (e) { flash(e.message); } finally { setProbing(false); }
  };
  const resetAll = async () => {
    try {
      await api.resetSettings();
      const refreshed = await api.getSettings();
      setSaved(refreshed);
      setForm({ baseUrl: '', apiKey: '', model: '', fallbacks: '' });
      flash('已恢复默认（清空数据库覆盖）');
    } catch (e) { flash(e.message); }
  };
  if (loading) return <section className="screen active"><div className="panel-shell"><div className="empty-card">设置加载中…</div></div></section>;
  return <section className="screen active"><div className="panel-shell"><div className="section-heading"><div><span className="section-kicker">⚙️ 设置</span><h2>学习与AI设置</h2><p className="muted">大模型配置保存在服务器数据库，重启不丢失{saved?.customized ? '（已自定义）' : '（当前为默认）'}</p></div></div>
    <div className="setup-block"><div className="block-title"><span>🎒</span><div><h3>年级</h3><p>决定AI出题与讲解的难度</p></div></div><div className="segmented difficulty-choice">{GRADES.map((g) => <button key={g} className={`choice-btn ${grade === g ? 'selected' : ''}`} onClick={() => saveGrade(g)}>{g}</button>)}</div></div>
    <div className="setup-block"><div className="block-title"><span>🤖</span><div><h3>大模型接入</h3><p>OpenAI兼容协议 · 配置存数据库 · 不指定默认模型</p></div></div>
      <div className="form-grid">
        <label>网关地址（留空用默认）<input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder={saved?.effectiveBaseUrl || 'https://...'} /></label>
        <label>模型（必选：下拉选择，或手动输入）{models.length ? <select value={showManual ? '__manual' : form.model} onChange={(e) => { if (e.target.value === '__manual') { setShowManual(true); } else { setShowManual(false); setForm({ ...form, model: e.target.value }); } }}><option value="">— 请选择模型 —</option>{models.map((m) => <option key={m} value={m}>{m}</option>)}<option value="__manual">⌨️ 手动输入…</option></select> : <span className="muted">点下方「刷新模型列表」加载</span>}{showManual && <input value={models.includes(form.model) ? '' : form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="手动输入模型名" />}</label>
        <label>兜底模型（可选，逗号分隔，主模型无通道时自动切换）<input value={form.fallbacks} onChange={(e) => setForm({ ...form, fallbacks: e.target.value })} placeholder="留空则不兜底" /></label>
        <label>密钥{saved?.hasApiKey ? `（已配置 ${saved.apiKeyPreview}，留空不修改）` : '（未配置）'}<input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={saved?.hasApiKey ? '留空 = 不修改' : 'sk-...'} autoComplete="off" /></label>
      </div>
      <p className="muted">密钥只存服务器数据库（data/ 目录，已忽略不进 Git），不会发给除网关外的任何地方。</p>
      <div className="result-actions"><button className="primary-btn" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存到数据库'}</button><button className="secondary-btn" disabled={testing} onClick={refreshModels}>{testing ? '拉取中…' : '刷新模型列表'}</button><button className="secondary-btn" disabled={probing} onClick={probe}>{probing ? '探测中…' : '🔍 自动找可用模型'}</button><button className="secondary-btn" onClick={resetAll}>恢复默认</button></div>
    </div>
  </div></section>;
}

export default SettingsView;
