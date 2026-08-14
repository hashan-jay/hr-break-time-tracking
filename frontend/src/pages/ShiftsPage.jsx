import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';

const HALF_HOUR_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0');
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

const emptyForm = {
  name: '',
  startTime: '08:00',
  endTime: '17:00',
  isActive: true,
};

export default function ShiftsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  const previewLabel = useMemo(() => {
    if (!form.startTime || !form.endTime) return '';
    const overnight = form.endTime <= form.startTime;
    const end = overnight ? `${form.endTime} (+1)` : form.endTime;
    return `${form.name || 'Shift'} (${form.startTime} – ${end})`;
  }, [form]);

  const load = async () => {
    const { data } = await api.get('/shifts', { params: { includeInactive: true } });
    setItems(data);
  };

  useEffect(() => {
    load().catch((err) => {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Failed to load shifts.');
    });
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/shifts/${editingId}`, form);
        setMsgType('success');
        setMessage('Shift updated.');
      } else {
        await api.post('/shifts', form);
        setMsgType('success');
        setMessage('Shift created.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Save failed.');
    }
  };

  const startEdit = (shift) => {
    setEditingId(shift.id);
    setForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      isActive: shift.isActive,
    });
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this shift? Employees keep their assignment; inactive shifts cannot be newly selected.')) return;
    try {
      await api.post(`/shifts/${id}/deactivate`);
      setMsgType('success');
      setMessage('Shift deactivated.');
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Deactivate failed.');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Shifts</h1>
          <p>Define military-time work shifts (30-minute steps). Overnight shifts are supported (e.g. 19:30 – 07:30).</p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <div className="split-forms">
        <form className="card-form" onSubmit={onSubmit}>
          <h2>{editingId ? 'Edit shift' : 'Add shift'}</h2>
          <label>
            Shift name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Night Shift" />
          </label>
          <label>
            Start time (military)
            <select required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
              {HALF_HOUR_OPTIONS.map((t) => <option key={`s-${t}`} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            End time (military)
            <select required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}>
              {HALF_HOUR_OPTIONS.map((t) => <option key={`e-${t}`} value={t}>{t}</option>)}
            </select>
          </label>
          {editingId && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
          )}
          <p className="hint">Preview: <strong>{previewLabel}</strong></p>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">{editingId ? 'Update' : 'Create'}</button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Overnight</th>
                <th>Employees</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.startTime}</td>
                  <td>{s.spansNextDay ? `${s.endTime} (+1)` : s.endTime}</td>
                  <td>{s.spansNextDay ? 'Yes' : 'No'}</td>
                  <td>{s.employeeCount}</td>
                  <td>{s.isActive ? 'Yes' : 'No'}</td>
                  <td className="row-actions">
                    <button type="button" className="btn link-btn" onClick={() => startEdit(s)}>Edit</button>
                    {s.isActive && (
                      <button type="button" className="btn link-btn danger" onClick={() => deactivate(s.id)}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={7} className="empty">No shifts yet. Create the first shift.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
