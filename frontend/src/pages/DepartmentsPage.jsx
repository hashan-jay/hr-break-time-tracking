import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';
import { useAuth } from '../auth/AuthContext';

const emptyForm = { name: '', description: '' };

export default function DepartmentsPage() {
  const { isDeveloper } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  const load = async () => {
    const { data } = await api.get('/departments', { params: { includeInactive: true } });
    setItems(data);
  };

  useEffect(() => {
    load().catch((err) => {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Failed to load departments.');
    });
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/departments/${editingId}`, { ...form, isActive: true });
        setMessage('Department updated.');
      } else {
        await api.post('/departments', form);
        setMessage('Department created.');
      }
      setMsgType('success');
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Save failed.');
    }
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this department?')) return;
    try {
      await api.delete(`/departments/${id}`);
      setMsgType('success');
      setMessage('Department deactivated.');
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
          <h1>Departments</h1>
          <p>Organize employees by department for tracking and reports.</p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <div className="split-forms">
        <form className="card-form" onSubmit={onSubmit}>
          <h2>{editingId ? 'Edit department' : 'Add department'}</h2>
          <label>
            Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </label>
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
                <th>Employees</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                    <div className="muted">{d.description || '—'}</div>
                  </td>
                  <td>{d.employeeCount}</td>
                  <td>{d.isActive ? 'Yes' : 'No'}</td>
                  <td className="row-actions">
                    <button type="button" className="link-btn" onClick={() => { setEditingId(d.id); setForm({ name: d.name, description: d.description || '' }); }}>
                      Edit
                    </button>
                    {isDeveloper && d.isActive && (
                      <button type="button" className="link-btn danger" onClick={() => deactivate(d.id)}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
