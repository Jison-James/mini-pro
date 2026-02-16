import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const locationIcon = new L.DivIcon({
    html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px;">📍</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
});

function LocationPicker({ position, onPick }) {
    useMapEvents({
        click(e) { onPick(e.latlng); }
    });
    return position ? <Marker position={position} icon={locationIcon} /> : null;
}

function FlyToPos({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) map.flyTo(position, 15, { duration: 0.8 });
    }, [position]);
    return null;
}

import { useAuth } from '../context/AuthContext';
import {
    getMyInstitutions, createInstitution, updateInstitution, deleteInstitution,
    getBuildings, createBuilding, deleteBuilding,
    getFloors, createFloor, deleteFloor, uploadFloorImage,
    getAccessRequests, respondAccessRequest,
    getAnalytics, getFeedback, setAccessRule, getAccessRules, deleteAccessRule,
    UPLOADS_BASE
} from '../utils/api';

function SettingsLocationPicker({ selectedInst }) {
    const [lat, setLat] = useState(selectedInst?.latitude || '');
    const [lng, setLng] = useState(selectedInst?.longitude || '');

    useEffect(() => {
        setLat(selectedInst?.latitude || '');
        setLng(selectedInst?.longitude || '');
    }, [selectedInst?.id]);

    const mapCenter = lat && lng ? [parseFloat(lat), parseFloat(lng)] : [9.9, 76.26];
    const mapZoom = lat && lng ? 13 : 5;

    return (
        <>
            <div className="form-group">
                <label>📍 Location — click on the map to update</label>
                <div style={{ height: 280, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border-color)', marginTop: 6 }}>
                    <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} zoomControl={true} attributionControl={false} key={selectedInst?.id}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                        <LocationPicker position={lat && lng ? [parseFloat(lat), parseFloat(lng)] : null} onPick={(latlng) => { setLat(latlng.lat.toFixed(6)); setLng(latlng.lng.toFixed(6)); }} />
                        <FlyToPos position={lat && lng ? [parseFloat(lat), parseFloat(lng)] : null} />
                    </MapContainer>
                </div>
                {lat && lng && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 6 }}>📌 Location: {parseFloat(lat).toFixed(4)}°, {parseFloat(lng).toFixed(4)}°</p>
                )}
            </div>
            <div className="grid grid-2">
                <div className="form-group"><label>Latitude</label><input name="latitude" className="form-input" type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="Click map or type" /></div>
                <div className="form-group"><label>Longitude</label><input name="longitude" className="form-input" type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="Click map or type" /></div>
            </div>
        </>
    );
}

/* ─── Building Card with expandable floor list ─── */
function BuildingCard({ building, instId, onRefresh, navigate }) {
    const [expanded, setExpanded] = useState(false);
    const [floors, setFloors] = useState([]);
    const [loadingFloors, setLoadingFloors] = useState(false);
    const [showAddFloor, setShowAddFloor] = useState(false);
    const [newFloorName, setNewFloorName] = useState('');
    const [newFloorNumber, setNewFloorNumber] = useState('');
    const [newFloorImage, setNewFloorImage] = useState(null);
    const fileInputRef = useRef(null);

    async function loadFloors() {
        setLoadingFloors(true);
        try {
            const data = await getFloors(building.id);
            setFloors(data);
        } catch (e) { console.error(e); }
        setLoadingFloors(false);
    }

    useEffect(() => {
        if (expanded) loadFloors();
    }, [expanded]);

    async function handleAddFloor(e) {
        e.preventDefault();
        try {
            const fd = new FormData();
            fd.append('name', newFloorName || `Floor ${newFloorNumber}`);
            fd.append('floor_number', newFloorNumber);
            if (newFloorImage) fd.append('image', newFloorImage);
            await createFloor(building.id, fd);
            setShowAddFloor(false);
            setNewFloorName('');
            setNewFloorNumber('');
            setNewFloorImage(null);
            loadFloors();
        } catch (e) { alert(e.message); }
    }

    async function handleDeleteFloor(floorId) {
        if (!confirm('Delete this floor and all its map data?')) return;
        try {
            await deleteFloor(floorId);
            loadFloors();
        } catch (e) { alert(e.message); }
    }

    async function handleUploadImage(floorId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const fd = new FormData();
                fd.append('image', file);
                await uploadFloorImage(floorId, fd);
                loadFloors();
            } catch (err) { alert(err.message); }
        };
        input.click();
    }

    async function handleDeleteBuilding() {
        if (!confirm(`Delete "${building.name}" and all its floors/maps?`)) return;
        try {
            await deleteBuilding(building.id);
            onRefresh();
        } catch (e) { alert(e.message); }
    }

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Building Header */}
            <div
                style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', gap: 12, background: expanded ? 'rgba(99,102,241,0.06)' : 'transparent', transition: 'background 0.2s' }}
                onClick={() => setExpanded(!expanded)}
            >
                <span style={{ fontSize: '1.4rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>🏛️ {building.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Code: {building.building_code || '—'} • Type: {building.building_type} • {building.floor_count} floor{building.floor_count !== 1 ? 's' : ''}
                    </p>
                </div>
                <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(); }} title="Delete building">🗑️</button>
            </div>

            {/* Expanded Floor List */}
            {expanded && (
                <div style={{ borderTop: '1px solid var(--border-color)' }}>
                    {loadingFloors ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading floors...</div>
                    ) : floors.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 12 }}>No floors added yet</p>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowAddFloor(true)}>+ Add First Floor</button>
                        </div>
                    ) : (
                        <div>
                            {floors.map(floor => (
                                <div key={floor.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                                    {/* Floor plan thumbnail */}
                                    <div style={{ width: 56, height: 56, borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {floor.image_url ? (
                                            <img src={`http://localhost:3001${floor.image_url}`} alt={floor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '1.2rem', opacity: 0.4 }}>🗺️</span>
                                        )}
                                    </div>

                                    {/* Floor info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{floor.name || `Floor ${floor.floor_number}`}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Floor #{floor.floor_number} {floor.image_url ? '• 🖼️ Has floor plan' : '• ⚠️ No floor plan'}
                                        </div>
                                    </div>

                                    {/* Floor actions */}
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        <button className="btn btn-primary btn-sm" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => navigate(`/editor/${instId}?building=${building.id}&floor=${floor.id}`)}>
                                            ✏️ Edit Map
                                        </button>
                                        <button className="btn btn-secondary btn-sm" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => handleUploadImage(floor.id)} title="Upload floor plan image">
                                            🖼️
                                        </button>
                                        <button className="btn btn-danger btn-sm" style={{ padding: '5px 8px', fontSize: '0.7rem' }} onClick={() => handleDeleteFloor(floor.id)} title="Delete floor">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add Floor button */}
                            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
                                <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowAddFloor(true)}>+ Add Floor</button>
                            </div>
                        </div>
                    )}

                    {/* Add Floor Form */}
                    {showAddFloor && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'rgba(99,102,241,0.04)' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 12 }}>Add New Floor</h4>
                            <form onSubmit={handleAddFloor}>
                                <div className="grid grid-2" style={{ gap: 12, marginBottom: 12 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Floor Number *</label>
                                        <input className="form-input" type="number" value={newFloorNumber} onChange={e => setNewFloorNumber(e.target.value)} placeholder="e.g., 1" required />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Floor Name</label>
                                        <input className="form-input" value={newFloorName} onChange={e => setNewFloorName(e.target.value)} placeholder="e.g., Ground Floor" />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label>Floor Plan Image (optional)</label>
                                    <input ref={fileInputRef} type="file" accept="image/*" className="form-input" onChange={e => setNewFloorImage(e.target.files[0])} style={{ padding: 8 }} />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="submit" className="btn btn-primary btn-sm">Add Floor</button>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowAddFloor(false); setNewFloorName(''); setNewFloorNumber(''); setNewFloorImage(null); }}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function InstitutionDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState('maps');
    const [institutions, setInstitutions] = useState([]);
    const [selectedInst, setSelectedInst] = useState(null);
    const [buildings, setBuildings] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newInst, setNewInst] = useState({ name: '', description: '', address: '', latitude: '', longitude: '' });
    const [newBuilding, setNewBuilding] = useState({ name: '', building_code: '', building_type: 'academic', floor_count: 1 });
    const [showBuildingForm, setShowBuildingForm] = useState(false);
    const [analytics, setAnalytics] = useState(null);
    const [feedback, setFeedback] = useState([]);
    const [accessReqs, setAccessReqs] = useState([]);
    const [accessRules, setAccessRules] = useState([]);
    const [newRule, setNewRule] = useState({ access_type: 'public' });
    const [showRuleForm, setShowRuleForm] = useState(false);

    useEffect(() => { loadInstitutions(); }, []);
    useEffect(() => { if (selectedInst) loadInstData(); }, [selectedInst, tab]);

    async function loadInstitutions() {
        try {
            const data = await getMyInstitutions();
            setInstitutions(data);
            if (data.length > 0 && !selectedInst) setSelectedInst(data[0]);
        } catch (e) { console.error(e); }
    }

    async function loadInstData() {
        try {
            if (tab === 'maps') setBuildings(await getBuildings(selectedInst.id));
            if (tab === 'analytics') setAnalytics(await getAnalytics(selectedInst.id));
            if (tab === 'feedback') setFeedback(await getFeedback(selectedInst.id));
            if (tab === 'access') {
                setAccessReqs(await getAccessRequests(selectedInst.id));
                setAccessRules(await getAccessRules(selectedInst.id));
            }
        } catch (e) { console.error(e); }
    }

    async function handleCreateInst(e) {
        e.preventDefault();
        try {
            const inst = await createInstitution({
                ...newInst,
                latitude: parseFloat(newInst.latitude) || null,
                longitude: parseFloat(newInst.longitude) || null
            });
            if (inst?.id) await updateInstitution(inst.id, { is_published: 1 });
            setShowCreate(false); setNewInst({ name: '', description: '', address: '', latitude: '', longitude: '' });
            loadInstitutions();
        } catch (e) { alert(e.message); }
    }

    async function handlePublish(inst) {
        try {
            await updateInstitution(inst.id, { is_published: inst.is_published ? 0 : 1 });
            loadInstitutions();
        } catch (e) { alert(e.message); }
    }

    async function handleDeleteInst(id) {
        if (!confirm('Delete this institution and all its maps?')) return;
        try {
            await deleteInstitution(id);
            setSelectedInst(null);
            loadInstitutions();
        } catch (e) { alert(e.message); }
    }

    async function handleCreateBuilding(e) {
        e.preventDefault();
        try {
            await createBuilding(selectedInst.id, { ...newBuilding, floor_count: parseInt(newBuilding.floor_count) || 1 });
            setShowBuildingForm(false); setNewBuilding({ name: '', building_code: '', building_type: 'academic', floor_count: 1 });
            setBuildings(await getBuildings(selectedInst.id));
        } catch (e) { alert(e.message); }
    }

    async function handleAccessResponse(reqId, status) {
        try {
            await respondAccessRequest(reqId, { status, reply: status === 'approved' ? 'Access granted' : 'Access denied' });
            setAccessReqs(await getAccessRequests(selectedInst.id));
        } catch (e) { alert(e.message); }
    }

    async function handleAddRule(e) {
        e.preventDefault();
        try {
            await setAccessRule(selectedInst.id, newRule);
            setShowRuleForm(false); setNewRule({ access_type: 'public' });
            setAccessRules(await getAccessRules(selectedInst.id));
        } catch (e) { alert(e.message); }
    }

    async function handleDeleteRule(id) {
        try { await deleteAccessRule(id); setAccessRules(await getAccessRules(selectedInst.id)); } catch (e) { alert(e.message); }
    }

    const tabs = [
        { key: 'maps', label: 'Maps', icon: '🗺️' },
        { key: 'access', label: 'Access Control', icon: '🔐' },
        { key: 'analytics', label: 'Analytics', icon: '📊' },
        { key: 'feedback', label: 'Feedback', icon: '💬' },
        { key: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    return (
        <div className="page">
            <div className="dashboard">
                <div className="dashboard-sidebar">
                    <div style={{ padding: '0 14px 16px', borderBottom: '1px solid var(--border-color)', marginBottom: 12 }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 8 }}>My Institutions</h3>
                        {institutions.map(inst => (
                            <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button className={`sidebar-item ${selectedInst?.id === inst.id ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setSelectedInst(inst)}>
                                    <span className="si-icon">🏢</span>
                                    <div>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{inst.name}</div>
                                        <span className={`badge badge-${inst.is_published ? 'success' : 'warning'}`} style={{ fontSize: '0.625rem' }}>
                                            {inst.is_published ? 'Published' : 'Draft'}
                                        </span>
                                    </div>
                                </button>
                                <button className="btn btn-danger btn-sm" style={{ padding: '4px 6px', fontSize: '0.7rem', minWidth: 'auto', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); handleDeleteInst(inst.id); }} title="Delete institution">🗑️</button>
                            </div>
                        ))}
                        <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => setShowCreate(true)}>
                            + New Institution
                        </button>
                    </div>
                    {tabs.map(t => (
                        <button key={t.key} className={`sidebar-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                            <span className="si-icon">{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>

                <div className="dashboard-main">
                    {!selectedInst && institutions.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">🏢</div>
                            <h3>No institutions yet</h3>
                            <p>Create your first institution to start building maps</p>
                            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>Create Institution</button>
                        </div>

                    ) : tab === 'maps' && selectedInst ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedInst.name} — Buildings & Maps</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{selectedInst.address || 'Manage your buildings and floor maps'}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => handlePublish(selectedInst)}>
                                        {selectedInst.is_published ? '📤 Unpublish' : '📥 Publish'}
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowBuildingForm(true)}>+ Add Building</button>
                                </div>
                            </div>

                            {/* Info banner */}
                            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                💡 <strong>How it works:</strong> Create buildings → Add floors to each building → Upload floor plan images → Edit the map for each floor to add navigation nodes & edges.
                            </div>

                            {buildings.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">🏗️</div>
                                    <h3>No buildings yet</h3>
                                    <p>Add your first building, then add floors and maps to it</p>
                                    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowBuildingForm(true)}>+ Add Building</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {buildings.map(b => (
                                        <BuildingCard
                                            key={b.id}
                                            building={b}
                                            instId={selectedInst.id}
                                            onRefresh={() => loadInstData()}
                                            navigate={navigate}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                    ) : tab === 'analytics' && analytics ? (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>📊 Analytics Dashboard</h2>
                            <div className="grid grid-4" style={{ marginBottom: 24 }}>
                                <div className="stat-card"><div className="stat-value">{analytics.totalNavigations}</div><div className="stat-label">Total Navigations</div></div>
                                <div className="stat-card"><div className="stat-value">{analytics.mostSearched.length}</div><div className="stat-label">Unique Rooms Searched</div></div>
                                <div className="stat-card"><div className="stat-value">{analytics.mostUsedPaths.length}</div><div className="stat-label">Unique Paths Used</div></div>
                                <div className="stat-card"><div className="stat-value">{analytics.routeModes.length}</div><div className="stat-label">Route Modes Used</div></div>
                            </div>
                            <div className="grid grid-2">
                                <div className="card">
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Most Searched Rooms</h3>
                                    {analytics.mostSearched.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet</p> : analytics.mostSearched.map((r, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.875rem' }}>{r.room}</span>
                                            <span className="badge badge-primary">{r.count}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="card">
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Navigation by Hour</h3>
                                    {analytics.peakHours.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet</p> : (
                                        <div className="chart-bar-container">
                                            {analytics.peakHours.map((h, i) => {
                                                const max = Math.max(...analytics.peakHours.map(x => x.count));
                                                return (
                                                    <div key={i} className="chart-bar" style={{ height: `${(h.count / max) * 100}%` }}>
                                                        <span className="chart-label">{h.hour}h</span>
                                                        <span className="chart-value">{h.count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="card">
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Route Mode Usage</h3>
                                    {analytics.routeModes.map((m, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.875rem' }}>{m.route_mode}</span>
                                            <span className="badge badge-info">{m.count}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="card">
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Top Search Terms</h3>
                                    {analytics.searchTerms.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet</p> : analytics.searchTerms.map((s, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.875rem' }}>"{s.searched_term}"</span>
                                            <span className="badge badge-warning">{s.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    ) : tab === 'access' ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>🔐 Access Control</h2>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowRuleForm(true)}>+ Add Rule</button>
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Access Rules</h3>
                            {accessRules.length === 0 ? <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>No rules — maps are public by default</p> : (
                                <div className="grid grid-3" style={{ marginBottom: 24 }}>
                                    {accessRules.map(r => (
                                        <div key={r.id} className="card" style={{ padding: 16 }}>
                                            <span className="badge badge-primary">{r.access_type}</span>
                                            {r.access_key && <p style={{ fontSize: '0.8125rem', marginTop: 6 }}>Key: {r.access_key}</p>}
                                            {r.email_pattern && <p style={{ fontSize: '0.8125rem', marginTop: 6 }}>Pattern: *{r.email_pattern}</p>}
                                            {r.valid_until && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Until: {new Date(r.valid_until).toLocaleDateString()}</p>}
                                            <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={() => handleDeleteRule(r.id)}>Remove</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Access Requests</h3>
                            {accessReqs.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No pending requests</p> : (
                                <div className="table-wrap">
                                    <table>
                                        <thead><tr><th>User</th><th>Email</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {accessReqs.map(r => (
                                                <tr key={r.id}>
                                                    <td>{r.user_name}</td>
                                                    <td>{r.user_email}</td>
                                                    <td>{r.message || '—'}</td>
                                                    <td><span className={`badge badge-${r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span></td>
                                                    <td>
                                                        {r.status === 'pending' && (
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                <button className="btn btn-success btn-sm" onClick={() => handleAccessResponse(r.id, 'approved')}>✓</button>
                                                                <button className="btn btn-danger btn-sm" onClick={() => handleAccessResponse(r.id, 'rejected')}>✗</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                    ) : tab === 'feedback' ? (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>💬 Feedback</h2>
                            {feedback.length === 0 ? (
                                <div className="empty-state"><div className="empty-icon">💬</div><h3>No feedback yet</h3></div>
                            ) : (
                                <div className="grid grid-2">
                                    {feedback.map(f => (
                                        <div key={f.id} className="card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <span style={{ fontWeight: 600 }}>{f.author_name}</span>
                                                <span>{'⭐'.repeat(f.rating)}</span>
                                            </div>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{f.comment}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>{new Date(f.created_at).toLocaleDateString()}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    ) : tab === 'settings' ? (
                        <div style={{ maxWidth: 600 }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 24 }}>⚙️ Institution Settings</h2>
                            {selectedInst && (
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const fd = new FormData(e.target);
                                    const data = Object.fromEntries(fd);
                                    data.latitude = parseFloat(data.latitude) || null;
                                    data.longitude = parseFloat(data.longitude) || null;
                                    await updateInstitution(selectedInst.id, data);
                                    loadInstitutions();
                                    alert('Settings saved!');
                                }}>
                                    <div className="form-group"><label>Name</label><input name="name" className="form-input" defaultValue={selectedInst.name} /></div>
                                    <div className="form-group"><label>Description</label><textarea name="description" className="form-textarea" defaultValue={selectedInst.description} /></div>
                                    <div className="form-group"><label>Address</label><input name="address" className="form-input" defaultValue={selectedInst.address} /></div>
                                    <div className="form-group"><label>Website</label><input name="website" className="form-input" defaultValue={selectedInst.website} /></div>
                                    <div className="form-group"><label>Contact Email</label><input name="contact_email" className="form-input" defaultValue={selectedInst.contact_email} /></div>
                                    <div className="form-group"><label>Contact Phone</label><input name="contact_phone" className="form-input" defaultValue={selectedInst.contact_phone} /></div>

                                    <div className="form-group">
                                        <label>Main Institution Map (Overview)</label>
                                        {selectedInst.main_map_url && (
                                            <div style={{ marginBottom: 8 }}>
                                                <img src={`${UPLOADS_BASE}${selectedInst.main_map_url}`} alt="Main Map" style={{ maxWidth: 200, maxHeight: 150, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border-color)' }} />
                                            </div>
                                        )}
                                        <input type="file" name="main_map" accept="image/*" className="form-input" />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            General map showing all buildings. Used for overview navigation.
                                        </p>
                                    </div>

                                    <SettingsLocationPicker selectedInst={selectedInst} />

                                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                                        <button className="btn btn-primary" type="submit">Save Settings</button>
                                    </div>
                                </form>
                            )}

                            {selectedInst && (
                                <div style={{ marginTop: 40, padding: 20, borderRadius: 'var(--radius)', border: '1px solid var(--danger)', background: 'rgba(239,68,68,0.05)' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>⚠️ Danger Zone</h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Deleting an institution will permanently remove all its buildings, floors, maps, and data.</p>
                                    <button className="btn btn-danger" onClick={() => handleDeleteInst(selectedInst.id)}>🗑️ Delete Institution</button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Create Institution Modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && setShowCreate(false)}>
                    <div className="modal" style={{ maxWidth: 600 }}>
                        <h2>🏢 Create Institution</h2>
                        <form onSubmit={handleCreateInst}>
                            <div className="form-group"><label>Name *</label><input className="form-input" value={newInst.name} onChange={e => setNewInst({ ...newInst, name: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={newInst.description} onChange={e => setNewInst({ ...newInst, description: e.target.value })} /></div>
                            <div className="form-group"><label>Address</label><input className="form-input" value={newInst.address} onChange={e => setNewInst({ ...newInst, address: e.target.value })} /></div>

                            <div className="form-group">
                                <label>📍 Location — click on the map to set</label>
                                <div style={{ height: 280, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border-color)', marginTop: 6 }}>
                                    <MapContainer center={[9.9, 76.26]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={true} attributionControl={false}>
                                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                                        <LocationPicker position={newInst.latitude && newInst.longitude ? [parseFloat(newInst.latitude), parseFloat(newInst.longitude)] : null} onPick={(latlng) => setNewInst({ ...newInst, latitude: latlng.lat.toFixed(6), longitude: latlng.lng.toFixed(6) })} />
                                        <FlyToPos position={newInst.latitude && newInst.longitude ? [parseFloat(newInst.latitude), parseFloat(newInst.longitude)] : null} />
                                    </MapContainer>
                                </div>
                                {newInst.latitude && newInst.longitude && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 6 }}>📌 Selected: {parseFloat(newInst.latitude).toFixed(4)}°, {parseFloat(newInst.longitude).toFixed(4)}°</p>
                                )}
                            </div>

                            <div className="grid grid-2">
                                <div className="form-group"><label>Latitude</label><input className="form-input" type="number" step="any" value={newInst.latitude} onChange={e => setNewInst({ ...newInst, latitude: e.target.value })} placeholder="Click map or type" /></div>
                                <div className="form-group"><label>Longitude</label><input className="form-input" type="number" step="any" value={newInst.longitude} onChange={e => setNewInst({ ...newInst, longitude: e.target.value })} placeholder="Click map or type" /></div>
                            </div>
                            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Building Modal */}
            {showBuildingForm && (
                <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && setShowBuildingForm(false)}>
                    <div className="modal">
                        <h2>🏗️ Add Building</h2>
                        <form onSubmit={handleCreateBuilding}>
                            <div className="form-group"><label>Building Name *</label><input className="form-input" value={newBuilding.name} onChange={e => setNewBuilding({ ...newBuilding, name: e.target.value })} required /></div>
                            <div className="form-group"><label>Building Code</label><input className="form-input" value={newBuilding.building_code} onChange={e => setNewBuilding({ ...newBuilding, building_code: e.target.value })} placeholder="e.g., BLK-A" /></div>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Type</label><select className="form-select" value={newBuilding.building_type} onChange={e => setNewBuilding({ ...newBuilding, building_type: e.target.value })}><option value="academic">Academic</option><option value="administrative">Administrative</option><option value="residential">Residential</option><option value="library">Library</option><option value="sports">Sports</option><option value="other">Other</option></select></div>
                                <div className="form-group"><label>Initial Floor Count</label><input className="form-input" type="number" min="1" value={newBuilding.floor_count} onChange={e => setNewBuilding({ ...newBuilding, floor_count: e.target.value })} /></div>
                            </div>
                            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowBuildingForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add Building</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Access Rule Modal */}
            {showRuleForm && (
                <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && setShowRuleForm(false)}>
                    <div className="modal">
                        <h2>🔐 Add Access Rule</h2>
                        <form onSubmit={handleAddRule}>
                            <div className="form-group">
                                <label>Access Type</label>
                                <select className="form-select" value={newRule.access_type} onChange={e => setNewRule({ ...newRule, access_type: e.target.value })}>
                                    <option value="public">Public</option><option value="key">Key-based</option><option value="email_pattern">Email Pattern</option>
                                    <option value="role">Role-based</option><option value="time_based">Time-based</option>
                                </select>
                            </div>
                            {newRule.access_type === 'key' && <div className="form-group"><label>Access Key</label><input className="form-input" value={newRule.access_key || ''} onChange={e => setNewRule({ ...newRule, access_key: e.target.value })} placeholder="Secret key" /></div>}
                            {newRule.access_type === 'email_pattern' && <div className="form-group"><label>Email Pattern (suffix)</label><input className="form-input" value={newRule.email_pattern || ''} onChange={e => setNewRule({ ...newRule, email_pattern: e.target.value })} placeholder="@university.edu" /></div>}
                            {newRule.access_type === 'time_based' && (
                                <div className="grid grid-2">
                                    <div className="form-group"><label>Valid From</label><input type="date" className="form-input" value={newRule.valid_from || ''} onChange={e => setNewRule({ ...newRule, valid_from: e.target.value })} /></div>
                                    <div className="form-group"><label>Valid Until</label><input type="date" className="form-input" value={newRule.valid_until || ''} onChange={e => setNewRule({ ...newRule, valid_until: e.target.value })} /></div>
                                </div>
                            )}
                            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowRuleForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add Rule</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
