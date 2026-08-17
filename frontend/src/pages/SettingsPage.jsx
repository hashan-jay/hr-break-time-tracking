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
  const [deptLimits, setDeptLimits] = useState([]);
  const [savingDeptId, setSavingDeptId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  const load = async () => {
    const [settingsRes, deptRes] = await Promise.all([
      api.get('/settings'),
      api.get('/settings/department-start-limits'),
    ]);
    setSettings(settingsRes.data);
    setDeptLimits(deptRes.data);
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

  const updateDeptLocal = (departmentId, field, value) => {
    setDeptLimits((prev) => prev.map((row) => (
      row.departmentId === departmentId ? { ...row, [field]: value } : row
    )));
  };

  const saveDept = async (row) => {
    setSavingDeptId(row.departmentId);
    try {
      const { data } = await api.put(`/settings/department-start-limits/${row.departmentId}`, {
        mealStartLimit: Number(row.mealStartLimit),
        comfortStartLimit: Number(row.comfortStartLimit),
      });
      setDeptLimits((prev) => prev.map((x) => (x.departmentId === data.departmentId ? data : x)));
      setMsgType('success');
      setMessage(`Start limits saved for ${data.departmentName}.`);
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Could not save department start limits.');
    } finally {
      setSavingDeptId(null);
    }
  };

  const saveAllDepartments = async () => {
    if (deptLimits.length === 0) return;
    setSavingAll(true);
    try {
      const updated = [];
      for (const row of deptLimits) {
        const { data } = await api.put(`/settings/department-start-limits/${row.departmentId}`, {
          mealStartLimit: Number(row.mealStartLimit),
          comfortStartLimit: Number(row.comfortStartLimit),
        });
        updated.push(data);
      }
      setDeptLimits(updated);
      setMsgType('success');
      setMessage('Start limits saved for all departments.');
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Could not save all department start limits.');
      await load();
    } finally {
      setSavingAll(false);
    }
  };

  const duration = settings.filter((s) => DURATION_KEYS.includes(s.key));
  const starts = settings.filter((s) => START_KEYS.includes(s.key));
  const other = settings.filter((s) => !DURATION_KEYS.includes(s.key) && !START_KEYS.includes(s.key));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>System Settings</h1>
          <p>Limits for Meal Break and Comfort Break duration and start counts.</p>
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
        <h2 className="settings-section-title">Break start limits by department</h2>
        <p className="hint">
          Each department has its own Meal and Comfort start counts per shift. Example: IT Meal 10
          means IT employees can start a meal break 10 times this shift; Finance Meal 2 means
          Finance employees can start it only twice. After the limit is reached they cannot start
          that break again until the next shift. Ending an open break is still allowed. Range 1–20.
        </p>
        <div className="settings-dept-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={savingAll || deptLimits.length === 0}
            onClick={saveAllDepartments}
          >
            {savingAll ? 'Saving…' : 'Save all departments'}
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Employees</th>
                <th>Meal starts / shift</th>
                <th>Comfort starts / shift</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deptLimits.map((row) => (
                <tr key={row.departmentId}>
                  <td className="col-name">{row.departmentName}</td>
                  <td>{row.employeeCount}</td>
                  <td>
                    <input
                      className="dept-limit-input"
                      type="number"
                      min={1}
                      max={20}
                      value={row.mealStartLimit}
                      onChange={(e) => updateDeptLocal(row.departmentId, 'mealStartLimit', e.target.value)}
                      aria-label={`${row.departmentName} meal start limit`}
                    />
                  </td>
                  <td>
                    <input
                      className="dept-limit-input"
                      type="number"
                      min={1}
                      max={20}
                      value={row.comfortStartLimit}
                      onChange={(e) => updateDeptLocal(row.departmentId, 'comfortStartLimit', e.target.value)}
                      aria-label={`${row.departmentName} comfort start limit`}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savingDeptId === row.departmentId || savingAll}
                      onClick={() => saveDept(row)}
                    >
                      {savingDeptId === row.departmentId ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
              {deptLimits.length === 0 && (
                <tr>
                  <td colSpan={5}>No departments found. Create departments first, then set start limits here.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="settings-list">
        <h2 className="settings-section-title">Default start limits for new departments</h2>
        <p className="hint">
          Used only when a new department is created. Existing departments keep the values in the
          table above until you change them.
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
