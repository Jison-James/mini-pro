import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSavedMaps, getHistory, getMyAccessRequests, updateProfile, unsaveMap } from '../utils/api';

export default function UserDashboard() {
    const { user } = useAuth();
    const [tab, setTab] = useState('profile');
    const [savedMaps, setSavedMaps] = useState([]);
    const [history, setHistory] = useState([]);
    const [accessRequests, setAccessRequests] = useState([]);
    const [profileForm, setProfileForm] = useState({ name: user?.name || '', department: '' });
    const [msg, setMsg] = useState('');

    useEffect(() => {
        loadData();
    }, [tab]);

    async function loadData() {
        try {
            if (tab === 'saved') setSavedMaps(await getSavedMaps());
            if (tab === 'history') setHistory(await getHistory());
            if (tab === 'access') setAccessRequests(await getMyAccessRequests());
        } catch (e) { console.error(e); }
    }

    async function handleUpdateProfile(e) {
        e.preventDefault();
        try {
            await updateProfile(profileForm);
            setMsg('Profile updated!');
            setTimeout(() => setMsg(''), 3000);
        } catch (e) { setMsg(e.message); }
    }

    async function handleUnsave(instId) {
        try {
            await unsaveMap(instId);
            setSavedMaps(prev => prev.filter(s => s.institution_id !== instId));
        } catch (e) { console.error(e); }
    }

    const tabs = [
        { key: 'profile', label: 'Profile', icon: '👤' },
        { key: 'saved', label: 'Saved Maps', icon: '💾' },
        { key: 'history', label: 'History', icon: '📜' },
        { key: 'access', label: 'Access Requests', icon: '🔑' },
    ];

    return (
        <div className="page">
            <div className="dashboard">
                <div className="dashboard-sidebar">
                    <div style={{ padding: '0 14px 20px', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>👤</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{user?.name}</h3>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{user?.email}</p>
                        <span className="badge badge-success" style={{ marginTop: 6 }}>{user?.role}</span>
                    </div>
                    {tabs.map(t => (
                        <button key={t.key} className={`sidebar-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                            <span className="si-icon">{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>
                <div className="dashboard-main">
                    {tab === 'profile' && (
                        <div style={{ maxWidth: 500 }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>Profile Settings</h2>
                            {msg && <div className={`toast toast-${msg.includes('!') ? 'success' : 'error'}`} style={{ marginBottom: 16 }}>{msg}</div>}
                            <form onSubmit={handleUpdateProfile}>
                                <div className="form-group">
                                    <label>Name</label>
                                    <input className="form-input" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Department</label>
                                    <input className="form-input" value={profileForm.department} onChange={e => setProfileForm({ ...profileForm, department: e.target.value })} placeholder="e.g., Computer Science" />
                                </div>
                                <button className="btn btn-primary" type="submit">Save Changes</button>
                            </form>
                        </div>
                    )}

                    {tab === 'saved' && (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>Saved Maps</h2>
                            {savedMaps.length === 0 ? (
                                <div className="empty-state"><div className="empty-icon">💾</div><h3>No saved maps</h3><p>Save institution maps for quick access</p></div>
                            ) : (
                                <div className="grid grid-3">
                                    {savedMaps.map(m => (
                                        <div key={m.id} className="card">
                                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>🏢 {m.institution_name}</h3>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Saved {new Date(m.created_at).toLocaleDateString()}</p>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                                <a href={`/map/${m.institution_id}`} className="btn btn-primary btn-sm">Navigate</a>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleUnsave(m.institution_id)}>Remove</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'history' && (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>Navigation History</h2>
                            {history.length === 0 ? (
                                <div className="empty-state"><div className="empty-icon">📜</div><h3>No history yet</h3><p>Your navigation history will appear here</p></div>
                            ) : (
                                <div className="table-wrap">
                                    <table>
                                        <thead><tr><th>Institution</th><th>Route</th><th>Mode</th><th>Date</th></tr></thead>
                                        <tbody>
                                            {history.map(h => (
                                                <tr key={h.id}>
                                                    <td>{h.institution_name}</td>
                                                    <td>{h.from_node_id ? `${h.from_node_id} → ${h.to_node_id}` : '—'}</td>
                                                    <td><span className="badge badge-primary">{h.route_mode}</span></td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{new Date(h.created_at).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'access' && (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>Access Requests</h2>
                            {accessRequests.length === 0 ? (
                                <div className="empty-state"><div className="empty-icon">🔑</div><h3>No access requests</h3><p>Your access requests will appear here</p></div>
                            ) : (
                                <div className="grid grid-2">
                                    {accessRequests.map(r => (
                                        <div key={r.id} className="card">
                                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>🏢 {r.institution_name}</h3>
                                            <span className={`badge badge-${r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`} style={{ marginTop: 6 }}>{r.status}</span>
                                            {r.message && <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 8 }}>Your message: {r.message}</p>}
                                            {r.reply && <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: 4 }}>Reply: {r.reply}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
