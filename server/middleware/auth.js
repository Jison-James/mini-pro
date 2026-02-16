import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'indoor-nav-secret-key-change-in-production';

export function verifyToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token provided' });

    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

export function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return next();
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    try {
        req.user = jwt.verify(token, JWT_SECRET);
    } catch (e) { /* ignore */ }
    next();
}

export { JWT_SECRET };
