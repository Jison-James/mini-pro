
import db from '../db/db.js';

/**
 * Middleware to check if a user has access to an institution's map data.
 * Assumes req.user is populated (via verifyToken or optionalAuth).
 * req.params should contain either institutionId or id (for institutions).
 */
export async function checkMapAccess(req, res, next) {
    try {
        const instId = req.params.instId || req.params.id || req.body.institution_id;
        if (!instId) return next(); // Can't check without ID

        // Admin and the Institution Owner always have access
        if (req.user && req.user.role === 'admin') return next();

        const institution = db.prepare('SELECT owner_id, is_published FROM institutions WHERE id = ?').get(instId);
        if (!institution) return res.status(404).json({ error: 'Institution not found' });

        if (req.user && req.user.id === institution.owner_id) return next();

        // Check map_access rules
        const rules = db.prepare('SELECT * FROM map_access WHERE institution_id = ?').all(instId);

        // If no rules and it's published, default to public
        if (rules.length === 0) {
            if (institution.is_published) return next();
            return res.status(403).json({ error: 'Access denied: Institution not published' });
        }

        let granted = false;
        const accessKey = req.query.access_key || req.headers['x-map-key'];

        for (const rule of rules) {
            if (rule.access_type === 'public') { granted = true; break; }
            if (rule.access_type === 'key' && accessKey === rule.access_key) { granted = true; break; }

            if (req.user) {
                if (rule.access_type === 'email_pattern' && req.user.email.endsWith(rule.email_pattern)) { granted = true; break; }
                if (rule.access_type === 'role' && rule.allowed_roles && rule.allowed_roles.split(',').includes(req.user.role)) { granted = true; break; }
                if (rule.access_type === 'time_based') {
                    const now = new Date();
                    const from = rule.valid_from ? new Date(rule.valid_from) : new Date(0);
                    const until = rule.valid_until ? new Date(rule.valid_until) : new Date('2099-12-31');
                    if (now >= from && now <= until) { granted = true; break; }
                }
            }
        }

        if (granted) return next();

        // Check if approved access request exists
        if (req.user) {
            const approved = db.prepare("SELECT id FROM access_requests WHERE user_id = ? AND institution_id = ? AND status = 'approved'").get(req.user.id, instId);
            if (approved) return next();
        }

        const hasKeyRule = rules.some(r => r.access_type === 'key');

        return res.status(403).json({
            error: 'Access denied',
            details: 'This map is private. Please request access to view it.',
            access_required: true,
            key_required: hasKeyRule
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
