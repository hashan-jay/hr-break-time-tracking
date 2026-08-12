import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';

export default function SettingsPage() {
  const [settings, setSettings] = useState([]);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  const load = async () => {
    const { data } = await api.get('/settings');
    setSettings(data);
  };

  useEffect(() => {
    load().catch((err) => {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Failed to load settings.');
    });
  }, []);

  const save = async (key, value) => {
    try {
      await api.put(`/settings/${encodeURIComponent(key)}`, { value });
      setMsgType('success');
      setMessage('Setting saved.');
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Save failed.');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>System Settings</h1>
          <p>Developer-managed configuration that affects live status thresholds shown to HR roles.</p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <div className="settings-list">
        {settings.map((s) => (
          <div className="setting-row" key={s.id}>
            <div>
              <strong>{s.key}</strong>
              <div className="muted">{s.description || '—'}</div>
            </div>
            <div className="setting-edit">
              <input
                value={s.value}
                onChange={(e) => {
                  setSettings((prev) => prev.map((x) => (x.id === s.id ? { ...x, value: e.target.value } : x)));
                }}
              />
              <button type="button" className="btn btn-primary" onClick={() => save(s.key, s.value)}>Save</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
