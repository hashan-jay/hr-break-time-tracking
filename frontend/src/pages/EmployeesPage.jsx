import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';
import { useAuth } from '../auth/AuthContext';

const emptyForm = {
  employeeCode: '',
  fullName: '',
  departmentId: '',
  shiftId: '',
};

export default function EmployeesPage() {
  const { can } = useAuth();
  const canEdit = can('employees');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  const load = async () => {
    const [empRes, deptRes, shiftRes] = await Promise.all([
      api.get('/employees', {
        params: {
          search: search || undefined,
        },
      }),
      api.get('/departments'),
      api.get('/shifts'),
    ]);
    setEmployees(empRes.data);
    setDepartments(deptRes.data);
    setShifts(shiftRes.data);
  };

  useEffect(() => {
    load().catch((err) => {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Failed to load employees.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const shiftId = form.shiftId ? Number(form.shiftId) : null;
      const payload = {
        ...form,
        departmentId: Number(form.departmentId),
        shiftId,
      };
      if (editingId) {
        await api.put(`/employees/${editingId}`, {
          fullName: payload.fullName,
          departmentId: payload.departmentId,
          shiftId: payload.shiftId,
          hireDate: new Date().toISOString(),
        });
        setMsgType('success');
        setMessage('Employee updated.');
      } else {
        await api.post('/employees', payload);
        setMsgType('success');
        setMessage('Employee created.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Save failed.');
    }
  };

  const startEdit = (emp) => {
    if (!canEdit) return;
    setEditingId(emp.id);
    setForm({
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      departmentId: String(emp.departmentId),
      shiftId: emp.shiftId ? String(emp.shiftId) : '',
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this employee? Their details will be permanently removed from the database.')) return;
    try {
      await api.delete(`/employees/${id}`);
      setMsgType('success');
      setMessage('Employee deleted.');
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

  const shiftOptions = shifts.filter((s) => s.isActive || String(s.id) === String(form.shiftId));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Employees</h1>
          <p>Maintain employee master data and assign work shifts for shift-wise reporting.</p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <div className="split-forms">
        {canEdit && (
          <form className="card-form" onSubmit={onSubmit}>
            <h2>{editingId ? 'Edit employee' : 'Add employee'}</h2>
            {!editingId && (
              <label>
                Employee code
                <input required value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
              </label>
            )}
            <label>
              Full name
              <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </label>
            <label>
              Department
              <select required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">Select…</option>
                {departments.filter((d) => !d.isDeleted).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label>
              Shift
              <select value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}>
                <option value="">No shift assigned</option>
                {shiftOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.displayLabel}</option>
                ))}
              </select>
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

        <div>
          <div className="toolbar">
            <input
              className="search"
              placeholder="Search employees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
            <button type="button" className="btn btn-ghost" onClick={load}>Search</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Shift</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td>{e.employeeCode}</td>
                    <td>{e.fullName}</td>
                    <td>{e.departmentName}</td>
                    <td>{e.shiftDisplay || e.shiftName || '—'}</td>
                    <td className="row-actions">
                      {canEdit && (
                        <button type="button" className="btn link-btn" onClick={() => startEdit(e)}>Edit</button>
                      )}
                      {canEdit && (
                      <button type="button" className="btn link-btn danger" onClick={() => remove(e.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
