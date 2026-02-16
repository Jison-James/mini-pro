import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEvents, createEvent, deleteEvent, getMyEvents } from '../utils/api';

export default function EventsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [myEvents, setMyEvents] = useState([]);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [tab, setTab] = useState('all');
    const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '', end_date: '' });

    useEffect(() => { loadEvents(); }, [search]);
    useEffect(() => { if (tab === 'my' && user) loadMyEvents(); }, [tab]);

    async function loadEvents() {
        try { setEvents(await getEvents(search ? `search=${encodeURIComponent(search)}` : '')); } catch (e) { console.error(e); }
    }

    async function loadMyEvents() {
        try { setMyEvents(await getMyEvents()); } catch (e) { console.error(e); }
    }

    async function handleCreate(e) {
        e.preventDefault();
        try {
            await createEvent(newEvent);
            setShowCreate(false); setNewEvent({ title: '', description: '', event_date: '', end_date: '' });
            loadEvents();
        } catch (e) { alert(e.message); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this event?')) return;
        try { await deleteEvent(id); loadEvents(); loadMyEvents(); } catch (e) { alert(e.message); }
    }

    const displayEvents = tab === 'my' ? myEvents : events;

    return (
        <div className="page">
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>🎉 Events</h1>
                        <p>Discover events and navigate to their locations</p>
                    </div>
                    {user && (user.role === 'event_organizer' || user.role === 'institution' || user.role === 'admin') && (
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create Event</button>
                    )}
                </div>
            </div>
            <div className="page-content">
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
                    <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
                        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All Events</button>
                        {user && <button className={`tab ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>My Events</button>}
                    </div>
                    <div style={{ flex: 1 }} />
                    <div className="search-bar">
                        <span className="search-icon">🔍</span>
                        <input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {displayEvents.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon">🎉</div><h3>No events found</h3><p>{tab === 'my' ? 'Create your first event' : 'Check back later for upcoming events'}</p></div>
                ) : (
                    <div className="grid grid-3">
                        {displayEvents.map(event => (
                            <div key={event.id} className="card" style={{ animation: 'slideUp 0.3s' }}>
                                <div style={{ marginBottom: 12 }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>🎪 {event.title}</h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{event.description}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                    {event.institution_name && <span className="badge badge-primary">🏢 {event.institution_name}</span>}
                                    {event.organizer_name && <span className="badge badge-info">👤 {event.organizer_name}</span>}
                                </div>
                                {event.event_date && (
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                        📅 {new Date(event.event_date).toLocaleDateString()} {event.end_date ? `— ${new Date(event.end_date).toLocaleDateString()}` : ''}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    {event.institution_id && (
                                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/map/${event.institution_id}`)}>🧭 Navigate</button>
                                    )}
                                    {user && event.organizer_id === user.id && (
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(event.id)}>🗑️</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showCreate && (
                <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setShowCreate(false)}>
                    <div className="modal">
                        <h2>🎉 Create Event</h2>
                        <form onSubmit={handleCreate}>
                            <div className="form-group"><label>Title *</label><input className="form-input" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} /></div>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Start Date</label><input type="datetime-local" className="form-input" value={newEvent.event_date} onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })} /></div>
                                <div className="form-group"><label>End Date</label><input type="datetime-local" className="form-input" value={newEvent.end_date} onChange={e => setNewEvent({ ...newEvent, end_date: e.target.value })} /></div>
                            </div>
                            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
