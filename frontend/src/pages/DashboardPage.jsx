import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { LoadingBlock, MessageBar, StatCard } from '../components/UiBits';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let timer;
    const load = async () => {
      try {
        const res = await api.get('/reports/dashboard');
        setData(res.data);
        setMessage('');
      } catch (err) {
        setMessage(err.response?.data?.message || 'Failed to load dashboard.');
      }
    };
    load();
    timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!data && !message) return <LoadingBlock label="Loading dashboard…" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Real-time snapshot of today’s break compliance across the organization.</p>
        </div>
        <Link className="btn btn-primary" to="/app/tracking">Open live tracking</Link>
      </header>

      <MessageBar message={message} type="error" onClose={() => setMessage('')} />

      {data && (
        <div className="stats-grid">
          <StatCard label="Active employees" value={data.activeEmployees} />
          <StatCard label="Departments" value={data.activeDepartments} />
          <StatCard label="On break now" value={data.onBreakNow} tone="amber" />
          <StatCard label="Well satisfied" value={data.wellSatisfiedToday} tone="green" />
          <StatCard label="Satisfied" value={data.satisfiedToday} tone="blue" />
          <StatCard label="Exceeded limit" value={data.exceededToday} tone="red" />
          <StatCard label="Break sessions today" value={data.totalBreaksToday} />
        </div>
      )}
    </div>
  );
}
