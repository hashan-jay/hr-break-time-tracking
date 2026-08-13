import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';

const emptyForm = {
  userName: '',
  email: '',
  fullName: '',
  password: '',
  role: 'HRAssistant',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  const load = async () => {
    const { data } = await api.get('/users');
    setUsers(data);
  };

  useEffect(() => {
    load().catch((err) => {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Failed to load users.');
    });
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      setMsgType('success');
      setMessage('User created.');
      setForm(emptyForm);
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Create failed.');
    }
  };

  const changeRole = async (user, role) => {
    try {
      await api.put(`/users/${user.id}`, {
        fullName: user.fullName,
        email: user.email,
        role,
        isActive: user.isActive,
      });
      setMsgType('success');
      setMessage('User updated.');
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Update failed.');
    }
  };

  const resetPassword = async (id) => {
    const newPassword = window.prompt('Enter new password (min 8 chars, mixed case, digit, symbol):');
    if (!newPassword) return;
    try {
      await api.post(`/users/${id}/password`, { newPassword });
      setMsgType('success');
      setMessage('Password updated.');
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Password change failed.');
    }
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      setMsgType('success');
      setMessage('User deactivated.');
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
          <h1>Users &amp; RBAC</h1>
          <p>Developer-only account administration for Developer, HR Manager, and HR Assistant roles.</p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <div className="split-forms">
        <form className="card-form" onSubmit={onSubmit}>
          <h2>Create user</h2>
          <label>Username<input required value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} /></label>
          <label>Full name<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
          <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Password<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label>
            Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="Developer">Developer</option>
              <option value="HRManager">HR Manager</option>
              <option value="HRAssistant">HR Assistant</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit">Create</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.fullName}</strong>
                    <div className="muted">{u.userName}</div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.roles?.[0] || 'HRAssistant'}
                      onChange={(e) => changeRole(u, e.target.value)}
                    >
                      <option value="Developer">Developer</option>
                      <option value="HRManager">HR Manager</option>
                      <option value="HRAssistant">HR Assistant</option>
                    </select>
                  </td>
                  <td>{u.isActive ? 'Yes' : 'No'}</td>
                  <td className="row-actions">
                    <button type="button" className="btn link-btn" onClick={() => resetPassword(u.id)}>Password</button>
                    {u.isActive && (
                      <button type="button" className="btn link-btn danger" onClick={() => deactivate(u.id)}>Deactivate</button>
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
