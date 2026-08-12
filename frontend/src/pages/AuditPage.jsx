import { useEffect, useState } from 'react';
import api from '../api/client';
import { MessageBar } from '../components/UiBits';

export default function AuditPage() {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/audit', { params: { take: 200 } })
      .then((res) => setItems(res.data))
      .catch((err) => setMessage(err.response?.data?.message || 'Failed to load audit log.'));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p>Critical activity trail for developer oversight.</p>
        </div>
      </header>

      <MessageBar message={message} type="error" onClose={() => setMessage('')} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When (UTC)</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.createdAt).toLocaleString()}</td>
                <td>{a.action}</td>
                <td>{a.entityType} {a.entityId ? `#${a.entityId}` : ''}</td>
                <td>{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
