import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';
import { settingLabel } from '../lib/breakHelpers';

const DURATION_KEYS = ['MealBreakLimitMinutes', 'ComfortBreakLimitMinutes'];
const START_KEYS = ['MealBreakStartLimit', 'ComfortBreakStartLimit'];

function SettingRow({ setting, min, max, onChange, onSave }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{settingLabel(setting.key)}</strong>
        <div className="muted">{setting.description || '—'}</div>
        <div className="muted mono">{setting.key}</div>
      </div>
      <div className="setting-edit">
        <input
          type="number"
          min={min}
          max={max}
          value={setting.value}
          onChange={(e) => onChange(setting.id, e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={() => onSave(setting.key, setting.value)}>
          Save
        </button>
      </div>
    </div>
  );
}

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

  const updateLocal = (id, value) => {
    setSettings((prev) => prev.map((x) => (x.id === id ? { ...x, value } : x)));
  };

  const duration = settings.filter((s) => DURATION_KEYS.includes(s.key));
  const starts = settings.filter((s) => START_KEYS.includes(s.key));
  const other = settings.filter((s) => !DURATION_KEYS.includes(s.key) && !START_KEYS.includes(s.key));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>System Settings</h1>
          <p>Developer-only limits for Meal Break and Comfort Break duration and start counts.</p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <section className="settings-list">
        <h2 className="settings-section-title">Break duration limits</h2>
        <p className="hint">
          Defaults: Meal 60 minutes, Comfort 20 minutes. At or under X:00 is WELL SATISFIED (green).
          Over X:00 is EXCEEDED BREAK TIME LIMIT (red).
        </p>
        {duration.map((s) => (
          <SettingRow key={s.id} setting={s} min={1} max={240} onChange={updateLocal} onSave={save} />
        ))}
      </section>

      <section className="settings-list">
        <h2 className="settings-section-title">Break start limits</h2>
        <p className="hint">
          How many times each employee may start that break during one shift. When starts used
          equals this number, they cannot start another break of that type until the next shift.
          Ending an open break is still allowed. Defaults: Meal 1, Comfort 2. Range 1–20.
        </p>
        {starts.map((s) => (
          <SettingRow key={s.id} setting={s} min={1} max={20} onChange={updateLocal} onSave={save} />
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
                  onChange={(e) => updateLocal(s.id, e.target.value)}
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
