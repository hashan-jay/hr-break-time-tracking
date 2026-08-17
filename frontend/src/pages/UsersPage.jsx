import { useEffect, useState, Fragment } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';
import { SECTIONS } from '../auth/AuthContext';

const emptyForm = {
  userName: '',
  email: '',
  fullName: '',
  password: '',
  role: 'HRAssistant',
};

function SectionChecks({ values, onToggle, disabled }) {
  return (
    <div className="perm-checks">
      {SECTIONS.map((section) => (
        <label key={section.key}>
          <input
            type="checkbox"
            checked={values.includes(section.key)}
            disabled={disabled}
            onChange={() => onToggle(section.key)}
          />
          {section.label}
        </label>
      ))}
    </div>
  );
}

function toggleValue(list, key) {
  return list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [savingRole, setSavingRole] = useState('');
  const [savingUserId, setSavingUserId] = useState('');

  const load = async () => {
    const [usersRes, rolesRes] = await Promise.all([
      api.get('/users'),
      api.get('/permissions/roles'),
    ]);
    setUsers(usersRes.data);
    setRoleDefaults(rolesRes.data);
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
      setMessage('User created with that role’s default section access.');
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
      setMessage('Role updated. Section access was reset to that role’s defaults.');
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

  const updateRoleLocal = (role, key) => {
    setRoleDefaults((prev) => prev.map((row) => (
      row.role === role && !row.locked
        ? { ...row, sections: toggleValue(row.sections, key) }
        : row
    )));
  };

  const saveRole = async (row) => {
    setSavingRole(row.role);
    try {
      const { data } = await api.put(`/permissions/roles/${encodeURIComponent(row.role)}`, {
        sections: row.sections,
      });
      setRoleDefaults((prev) => prev.map((x) => (x.role === data.role ? data : x)));
      setMsgType('success');
      setMessage(`Default access saved for ${data.roleLabel}. New users with this role will get these sections.`);
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Could not save role access.');
    } finally {
      setSavingRole('');
    }
  };

  const updateUserLocal = (userId, key) => {
    setUsers((prev) => prev.map((u) => (
      u.id === userId
        ? { ...u, permissions: toggleValue(u.permissions || [], key) }
        : u
    )));
  };

  const saveUserAccess = async (user) => {
    setSavingUserId(user.id);
    try {
      const { data } = await api.put(`/users/${user.id}/permissions`, {
        sections: user.permissions || [],
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, permissions: data } : u)));
      setMsgType('success');
      setMessage(`Section access saved for ${user.fullName}.`);
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Could not save user access.');
    } finally {
      setSavingUserId('');
    }
  };

  const isDeveloperUser = (user) => (user.roles || []).includes('Developer');

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Users &amp; RBAC</h1>
          <p>
            Assign each user a role, then tick the staff sections they may open.
            Developer accounts always keep full access. Users administration stays Developer-only.
          </p>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <section className="settings-list perm-panel">
        <h2 className="settings-section-title">Default access by role</h2>
        <p className="hint">
          These defaults are copied when you create a user or change a user’s role.
          You can then tick different sections for that person below.
        </p>
        {roleDefaults.map((row) => (
          <div className="perm-role-row" key={row.role}>
            <div>
              <strong>{row.roleLabel}</strong>
              <div className="muted">{row.locked ? 'Full access (cannot be reduced)' : 'Tick the sections this role should receive by default'}</div>
            </div>
            <SectionChecks
              values={row.sections || []}
              disabled={row.locked}
              onToggle={(key) => updateRoleLocal(row.role, key)}
            />
            {!row.locked && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingRole === row.role}
                onClick={() => saveRole(row)}
              >
                {savingRole === row.role ? 'Saving…' : 'Save defaults'}
              </button>
            )}
          </div>
        ))}
      </section>

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
                <Fragment key={u.id}>
                  <tr>
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
                  <tr className="perm-user-row">
                    <td colSpan={5}>
                      <div className="perm-user-access">
                        <strong>Section access</strong>
                        <SectionChecks
                          values={isDeveloperUser(u) ? SECTIONS.map((s) => s.key) : (u.permissions || [])}
                          disabled={isDeveloperUser(u)}
                          onToggle={(key) => updateUserLocal(u.id, key)}
                        />
                        {!isDeveloperUser(u) && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={savingUserId === u.id}
                            onClick={() => saveUserAccess(u)}
                          >
                            {savingUserId === u.id ? 'Saving…' : 'Save access'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
