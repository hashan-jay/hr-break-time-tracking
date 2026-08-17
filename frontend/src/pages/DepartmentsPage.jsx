import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';
import { useAuth } from '../auth/AuthContext';

const emptyForm = { name: '', description: '' };

export default function DepartmentsPage() {
  const { can } = useAuth();
  const canEdit = can('departments');
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  const load = async () => {
    const { data } = await api.get('/departments', {
      params: { includeDeleted: canEdit || undefined },
    });
    setItems(data);
  };

  useEffect(() => {
    load().catch((err) => {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Failed to load departments.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      if (editingId) {
        await api.put(`/departments/${editingId}`, form);
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

  const remove = async (id) => {
    if (!window.confirm('Delete this department? It will be hidden from HR Manager and HR Assistant views.')) return;
    try {
      await api.delete(`/departments/${id}`);
      setMsgType('success');
      setMessage('Department deleted.');
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Delete failed.');
    }
  };

  const recover = async (id) => {
    if (!window.confirm('Recover this deleted department?')) return;
    try {
      await api.post(`/departments/${id}/recover`);
      setMsgType('success');
      setMessage('Department recovered.');
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Recover failed.');
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

      <div className={canEdit ? 'split-forms' : undefined}>
        {canEdit && (
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
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Employees</th>
                {canEdit && <th>Status</th>}
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className={d.isDeleted ? 'is-deleted' : undefined}>
                  <td>
                    <strong>{d.name}</strong>
                    <div className="muted">{d.description || '—'}</div>
                  </td>
                  <td>{d.employeeCount}</td>
                  {canEdit && (
                    <td>
                      {d.isDeleted
                        ? <span className="status-badge status-red">Deleted</span>
                        : <span className="status-badge status-green">Active</span>}
                    </td>
                  )}
                  {canEdit && (
                    <td className="row-actions">
                      {!d.isDeleted && (
                        <>
                          <button
                            type="button"
                            className="btn link-btn"
                            onClick={() => {
                              setEditingId(d.id);
                              setForm({ name: d.name, description: d.description || '' });
                            }}
                          >
                            Edit
                          </button>
                          <button type="button" className="btn link-btn danger" onClick={() => remove(d.id)}>Delete</button>
                        </>
                      )}
                      {d.isDeleted && (
                        <button type="button" className="btn link-btn recover" onClick={() => recover(d.id)}>Recover</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
