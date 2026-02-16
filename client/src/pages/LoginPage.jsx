import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register } from '../utils/api';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('user');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = isRegister
                ? await register(email, password, name, role)
                : await login(email, password);
            loginUser(data.token, data.user);
            navigate(data.user.role === 'institution' ? '/institution' : data.user.role === 'admin' ? '/admin' : '/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ width: '100%', maxWidth: 440, animation: 'slideUp 0.4s' }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏢</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {isRegister ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
                        {isRegister ? 'Join the indoor navigation platform' : 'Sign in to continue'}
                    </p>
                </div>

                {error && (
                    <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '0.875rem', marginBottom: 16 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {isRegister && (
                        <div className="form-group">
                            <label>Full Name</label>
                            <input className="form-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
                        </div>
                    )}
                    <div className="form-group">
                        <label>Email</label>
                        <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                    {isRegister && (
                        <div className="form-group">
                            <label>I am a...</label>
                            <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                                <option value="user">User — Navigate maps</option>
                                <option value="institution">Institution — Create & manage maps</option>
                                <option value="event_organizer">Event Organizer — Create events</option>
                            </select>
                        </div>
                    )}
                    <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                        {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <button onClick={() => { setIsRegister(!isRegister); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>
                        {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                    </button>
                </div>

                {!isRegister && (
                    <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Demo credentials:</p>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            Admin: <code style={{ color: 'var(--accent)' }}>admin@indoornav.com</code> / <code style={{ color: 'var(--accent)' }}>admin123</code>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
