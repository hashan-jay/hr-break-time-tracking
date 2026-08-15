import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';
import { settingLabel } from '../lib/breakHelpers';

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

  const primaryKeys = ['MealBreakLimitMinutes', 'ComfortBreakLimitMinutes'];
  const primary = settings.filter((s) => primaryKeys.includes(s.key));
  const other = settings.filter((s) => !primaryKeys.includes(s.key));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>System Settings</h1>
          <p>Developer-only limits for Meal Break and Comfort Break status thresholds.</p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <section className="settings-list">
        <h2 className="settings-section-title">Break duration limits</h2>
        <p className="hint">
          Defaults: Meal 60 minutes, Comfort 20 minutes. Adjustable here only by Developer.
        </p>
        {primary.map((s) => (
          <div className="setting-row" key={s.id}>
            <div>
              <strong>{settingLabel(s.key)}</strong>
              <div className="muted">{s.description || '—'}</div>
              <div className="muted mono">{s.key}</div>
            </div>
            <div className="setting-edit">
              <input
                type="number"
                min={1}
                max={240}
                value={s.value}
                onChange={(e) => {
                  setSettings((prev) => prev.map((x) => (x.id === s.id ? { ...x, value: e.target.value } : x)));
                }}
              />
              <button type="button" className="btn btn-primary" onClick={() => save(s.key, s.value)}>Save</button>
            </div>
          </div>
        ))}
      </section>

      {other.length > 0 && (
        <section className="settings-list">
          <h2 className="settings-section-title">Other settings</h2>
          {other.map((s) => (
            <div className="setting-row" key={s.id}>
              <div>
                <strong>{settingLabel(s.key)}</strong>
                <div className="muted">{s.description || '—'}</div>
                <div className="muted mono">{s.key}</div>
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
        </section>
      )}
    </div>
  );
}
