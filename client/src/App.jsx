import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import UserDashboard from './pages/UserDashboard';
import InstitutionDashboard from './pages/InstitutionDashboard';
import MapEditor from './pages/MapEditor';
import MapViewer from './pages/MapViewer';
import EventsPage from './pages/EventsPage';
import AdminPanel from './pages/AdminPanel';
import './index.css';

function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = (path) => location.pathname.startsWith(path) ? 'nav-active' : '';

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-logo">
                <span className="logo-icon">🏢</span> IndoorNav
            </Link>
            <div className="navbar-links">
                <Link to="/" className={isActive('/home') || location.pathname === '/' ? '' : ''}>Home</Link>
                <Link to="/events" className={isActive('/events')}>Events</Link>
                {user ? (
                    <>
                        {user.role === 'admin' && <Link to="/admin" className={isActive('/admin')}>Admin</Link>}
                        {(user.role === 'institution') && <Link to="/institution" className={isActive('/institution')}>Dashboard</Link>}
                        {user.role === 'user' && <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>}
                        {user.role === 'event_organizer' && <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {user.name} <span className={`badge badge-${user.role === 'admin' ? 'danger' : user.role === 'institution' ? 'primary' : 'success'}`}>{user.role}</span>
                        </span>
                        <button onClick={() => { logout(); navigate('/'); }}>Logout</button>
                    </>
                ) : (
                    <Link to="/login" className="btn btn-primary btn-sm">Login</Link>
                )}
            </div>
        </nav>
    );
}

function AppRoutes() {
    return (
        <>
            <Navbar />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/institution" element={<InstitutionDashboard />} />
                <Route path="/editor/:institutionId" element={<MapEditor />} />
                <Route path="/map/:institutionId" element={<MapViewer />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/admin" element={<AdminPanel />} />
            </Routes>
        </>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}
