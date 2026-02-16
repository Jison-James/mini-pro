import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    getAdminUsers, updateUserRole, deleteUser,
    getAdminInstitutions, moderateInstitution, adminDeleteInstitution,
    getAdminAnalytics
} from '../utils/api';

export default function AdminPanel() {
    const { user } = useAuth();
    const [tab, setTab] = useState('overview');
    const [users, setUsers] = useState([]);
    const [institutions, setInstitutions] = useState([]);
    const [analytics, setAnalytics] = useState(null);

    useEffect(() => { loadData(); }, [tab]);

    async function loadData() {
        try {
            if (tab === 'users') setUsers(await getAdminUsers());
            if (tab === 'institutions') setInstitutions(await getAdminInstitutions());
            if (tab === 'overview' || tab === 'analytics') setAnalytics(await getAdminAnalytics());
        } catch (e) { console.error(e); }
    }

    async function handleRoleChange(userId, role) {
        try { await updateUserRole(userId, role); loadData(); } catch (e) { alert(e.message); }
    }

    async function handleDeleteUser(id) {
        if (!confirm('Delete this user?')) return;
        try { await deleteUser(id); loadData(); } catch (e) { alert(e.message); }
    }

    async function handleModerate(id, publish) {
        try { await moderateInstitution(id, { is_published: publish }); loadData(); } catch (e) { alert(e.message); }
    }

    async function handleDeleteInst(id) {
        if (!confirm('Delete this institution?')) return;
        try { await adminDeleteInstitution(id); loadData(); } catch (e) { alert(e.message); }
    }

    if (user?.role !== 'admin') {
        return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="empty-state"><div className="empty-icon">⛔</div><h3>Access Denied</h3><p>Admin access required</p></div></div>;
    }

    const tabs = [
        { key: 'overview', label: 'Overview', icon: '📊' },
        { key: 'users', label: 'Users', icon: '👥' },
        { key: 'institutions', label: 'Institutions', icon: '🏢' },
        { key: 'analytics', label: 'System Analytics', icon: '📈' },
    ];

    return (
        <div className="page">
            <div className="dashboard">
                <div className="dashboard-sidebar">
                    <div style={{ padding: '0 14px 16px', borderBottom: '1px solid var(--border-color)', marginBottom: 12 }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🛡️</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Admin Panel</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>System Administration</p>
                    </div>
                    {tabs.map(t => (
                        <button key={t.key} className={`sidebar-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                            <span className="si-icon">{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>

                <div className="dashboard-main">
                    {tab === 'overview' && analytics && (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>📊 System Overview</h2>
                            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                                <div className="stat-card"><div className="stat-value" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{analytics.totals.users}</div><div className="stat-label">Total Users</div></div>
                                <div className="stat-card"><div className="stat-value" style={{ color: 'var(--accent)' }}>{analytics.totals.institutions}</div><div className="stat-label">Institutions</div></div>
                                <div className="stat-card"><div className="stat-value" style={{ color: 'var(--success)' }}>{analytics.totals.navigations}</div><div className="stat-label">Navigations</div></div>
                                <div className="stat-card"><div className="stat-value" style={{ color: 'var(--warning)' }}>{analytics.totals.events}</div><div className="stat-label">Events</div></div>
                            </div>
                            <div className="grid grid-2">
                                <div className="card">
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Users by Role</h3>
                                    {analytics.usersByRole.map((r, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                            <span className={`badge badge-${r.role === 'admin' ? 'danger' : r.role === 'institution' ? 'primary' : 'success'}`}>{r.role}</span>
                                            <span style={{ fontWeight: 700 }}>{r.count}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="card">
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Recent Users</h3>
                                    {analytics.recentUsers.map(u => (
                                        <div key={u.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                                            <span style={{ fontWeight: 600 }}>{u.name}</span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.75rem' }}>{u.email}</span>
                                            <span className={`badge badge-${u.role === 'admin' ? 'danger' : 'info'}`} style={{ marginLeft: 8, fontSize: '0.625rem' }}>{u.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {analytics.dailyNavs.length > 0 && (
                                <div className="card" style={{ marginTop: 20 }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Daily Navigations (30 days)</h3>
                                    <div className="chart-bar-container">
                                        {analytics.dailyNavs.map((d, i) => {
                                            const max = Math.max(...analytics.dailyNavs.map(x => x.count));
                                            return (
                                                <div key={i} className="chart-bar" style={{ height: `${(d.count / max) * 100}%` }}>
                                                    <span className="chart-value">{d.count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'users' && (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>👥 User Management</h2>
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.id}>
                                                <td style={{ fontWeight: 600 }}>{u.name}</td>
                                                <td>{u.email}</td>
                                                <td>
                                                    <select className="form-select" value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8125rem' }}>
                                                        <option value="user">User</option><option value="institution">Institution</option><option value="event_organizer">Event Organizer</option><option value="admin">Admin</option>
                                                    </select>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                                <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>🗑️</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {tab === 'institutions' && (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>🏢 Institution Management</h2>
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Name</th><th>Owner</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {institutions.map(inst => (
                                            <tr key={inst.id}>
                                                <td style={{ fontWeight: 600 }}>{inst.name}</td>
                                                <td>{inst.owner_name}</td>
                                                <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{inst.address || '—'}</td>
                                                <td>
                                                    <span className={`badge badge-${inst.is_published ? 'success' : 'warning'}`}>
                                                        {inst.is_published ? 'Published' : 'Draft'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className={`btn btn-${inst.is_published ? 'warning' : 'success'} btn-sm`} onClick={() => handleModerate(inst.id, !inst.is_published)}>
                                                            {inst.is_published ? 'Unpublish' : 'Publish'}
                                                        </button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteInst(inst.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {tab === 'analytics' && analytics && (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>📈 System Analytics</h2>
                            <div className="grid grid-4" style={{ marginBottom: 24 }}>
                                <div className="stat-card"><div className="stat-value">{analytics.totals.users}</div><div className="stat-label">Users</div></div>
                                <div className="stat-card"><div className="stat-value">{analytics.totals.institutions}</div><div className="stat-label">Institutions</div></div>
                                <div className="stat-card"><div className="stat-value">{analytics.totals.navigations}</div><div className="stat-label">Navigations</div></div>
                                <div className="stat-card"><div className="stat-value">{analytics.totals.events}</div><div className="stat-label">Events</div></div>
                            </div>
                            <div className="card">
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Recent Navigations</h3>
                                {analytics.recentNavs.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No navigation data yet</p> : (
                                    <div className="table-wrap">
                                        <table>
                                            <thead><tr><th>Institution</th><th>From</th><th>To</th><th>Mode</th><th>Time</th></tr></thead>
                                            <tbody>
                                                {analytics.recentNavs.map(n => (
                                                    <tr key={n.id}>
                                                        <td>{n.institution_name || '—'}</td>
                                                        <td>{n.from_node_name || '—'}</td>
                                                        <td>{n.to_node_name || '—'}</td>
                                                        <td><span className="badge badge-primary">{n.route_mode}</span></td>
                                                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(n.created_at).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
