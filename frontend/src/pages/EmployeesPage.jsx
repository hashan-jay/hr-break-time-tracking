import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';
import { useAuth } from '../auth/AuthContext';

const emptyForm = {
  employeeCode: '',
  fullName: '',
  departmentId: '',
  jobTitle: '',
  email: '',
  phone: '',
};

export default function EmployeesPage() {
  const { canManageMasterData } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  const load = async () => {
    const [empRes, deptRes] = await Promise.all([
      api.get('/employees', { params: { search: search || undefined, includeInactive: true } }),
      api.get('/departments', { params: { includeInactive: true } }),
    ]);
    setEmployees(empRes.data);
    setDepartments(deptRes.data);
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
    try {
      const payload = {
        ...form,
        departmentId: Number(form.departmentId),
      };
      if (editingId) {
        await api.put(`/employees/${editingId}`, {
          fullName: payload.fullName,
          departmentId: payload.departmentId,
          jobTitle: payload.jobTitle,
          email: payload.email,
          phone: payload.phone,
          isActive: true,
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
    setEditingId(emp.id);
    setForm({
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      departmentId: String(emp.departmentId),
      jobTitle: emp.jobTitle || '',
      email: emp.email || '',
      phone: emp.phone || '',
    });
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      setMsgType('success');
      setMessage('Employee deactivated.');
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
          <h1>Employees</h1>
          <p>Maintain employee master data used by live break tracking.</p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <div className="split-forms">
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
              {departments.filter((d) => d.isActive).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label>
            Job title
            <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                  <th>Title</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td>{e.employeeCode}</td>
                    <td>{e.fullName}</td>
                    <td>{e.departmentName}</td>
                    <td>{e.jobTitle || '—'}</td>
                    <td>{e.isActive ? 'Yes' : 'No'}</td>
                    <td className="row-actions">
                      <button type="button" className="link-btn" onClick={() => startEdit(e)}>Edit</button>
                      {canManageMasterData && e.isActive && (
                        <button type="button" className="link-btn danger" onClick={() => deactivate(e.id)}>Deactivate</button>
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
