import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getInstitutions, UPLOADS_BASE } from '../utils/api';
import 'leaflet/dist/leaflet.css';

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const customIcon = new L.DivIcon({
    html: `<div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">🏢</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

function FlyTo({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, 12, { duration: 1.5 });
    }, [center, map]);
    return null;
}

// Demo institutions for showcasing
const DEMO_INSTITUTIONS = [
    { id: 'demo-1', name: 'MIT Campus', address: 'Cambridge, MA', latitude: 42.3601, longitude: -71.0942, description: 'Massachusetts Institute of Technology', is_published: 1 },
    { id: 'demo-2', name: 'Stanford University', address: 'Stanford, CA', latitude: 37.4275, longitude: -122.1697, description: 'Stanford University Campus', is_published: 1 },
    { id: 'demo-3', name: 'IIT Bombay', address: 'Mumbai, India', latitude: 19.1334, longitude: 72.9133, description: 'Indian Institute of Technology Bombay', is_published: 1 },
    { id: 'demo-4', name: 'Oxford University', address: 'Oxford, UK', latitude: 51.7548, longitude: -1.2544, description: 'University of Oxford', is_published: 1 },
    { id: 'demo-5', name: 'NUS Singapore', address: 'Singapore', latitude: 1.2966, longitude: 103.7764, description: 'National University of Singapore', is_published: 1 },
];

export default function HomePage() {
    const [institutions, setInstitutions] = useState([]);
    const [search, setSearch] = useState('');
    const [flyCenter, setFlyCenter] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        loadInstitutions();
    }, []);

    async function loadInstitutions() {
        try {
            const data = await getInstitutions();
            setInstitutions([...DEMO_INSTITUTIONS, ...data]);
        } catch {
            setInstitutions(DEMO_INSTITUTIONS);
        }
    }

    async function handleSearch(e) {
        const q = e.target.value;
        setSearch(q);
        if (q.length > 1) {
            // Client-side filter for instant results
            const clientResults = institutions.filter(
                i => i.name.toLowerCase().includes(q.toLowerCase()) || (i.address && i.address.toLowerCase().includes(q.toLowerCase()))
            );
            setSearchResults(clientResults);
            // Also query server for latest published data
            try {
                const serverResults = await getInstitutions(q);
                const ids = new Set(clientResults.map(i => i.id));
                const merged = [...clientResults, ...serverResults.filter(s => !ids.has(s.id))];
                setSearchResults(merged);
                // Add new markers to map
                setInstitutions(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    return [...prev, ...serverResults.filter(s => !existingIds.has(s.id))];
                });
            } catch { }
        } else {
            setSearchResults([]);
        }
    }

    function selectInstitution(inst) {
        setSearch(inst.name);
        setSearchResults([]);
        if (inst.latitude && inst.longitude) {
            setFlyCenter([inst.latitude, inst.longitude]);
        }
    }

    return (
        <div className="page">
            <div className="home-map">
                <div className="home-search-overlay">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search institutions or locations..."
                        value={search}
                        onChange={handleSearch}
                    />
                    {searchResults.length > 0 && (
                        <div className="search-results">
                            {searchResults.map(inst => (
                                <div key={inst.id} className="search-result-item" onClick={() => selectInstitution(inst)}>
                                    <div style={{ fontWeight: 600 }}>🏢 {inst.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inst.address}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <MapContainer
                    center={[20, 0]}
                    zoom={2}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    attributionControl={false}
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <FlyTo center={flyCenter} />
                    {institutions.filter(i => i.latitude && i.longitude).map(inst => (
                        <Marker key={inst.id} position={[inst.latitude, inst.longitude]} icon={customIcon}>
                            <Popup>
                                <div className="inst-popup">
                                    <h3>{inst.name}</h3>
                                    <p>{inst.address}</p>
                                    <p>{inst.description}</p>
                                    <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }}
                                        onClick={() => navigate(`/map/${inst.id}`)}>
                                        Navigate →
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
