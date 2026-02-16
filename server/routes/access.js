import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Get access rules for institution
router.get('/:instId', (req, res) => {
    try {
        const rules = db.prepare('SELECT * FROM map_access WHERE institution_id = ?').all(req.params.instId);
        res.json(rules);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set access rule
router.post('/:instId', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { access_type, access_key, email_pattern, allowed_roles, valid_from, valid_until, department } = req.body;
        const id = uuid();
        db.prepare(
            `INSERT INTO map_access (id, institution_id, access_type, access_key, email_pattern, allowed_roles, valid_from, valid_until, department)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, req.params.instId, access_type || 'public', access_key || null, email_pattern || null, allowed_roles || null, valid_from || null, valid_until || null, department || null);
        res.status(201).json({ id, access_type });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete access rule
router.delete('/rule/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        db.prepare('DELETE FROM map_access WHERE id = ?').run(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check access for user
router.post('/:instId/check', verifyToken, (req, res) => {
    try {
        const { access_key } = req.body;
        const rules = db.prepare('SELECT * FROM map_access WHERE institution_id = ?').all(req.params.instId);

        // If no rules, default public
        if (rules.length === 0) return res.json({ granted: true, reason: 'public' });

        for (const rule of rules) {
            if (rule.access_type === 'public') return res.json({ granted: true, reason: 'public' });
            if (rule.access_type === 'key' && access_key === rule.access_key) return res.json({ granted: true, reason: 'key' });
            if (rule.access_type === 'email_pattern' && req.user.email.endsWith(rule.email_pattern)) return res.json({ granted: true, reason: 'email' });
            if (rule.access_type === 'role' && rule.allowed_roles && rule.allowed_roles.split(',').includes(req.user.role)) return res.json({ granted: true, reason: 'role' });
            if (rule.access_type === 'time_based') {
                const now = new Date();
                const from = rule.valid_from ? new Date(rule.valid_from) : new Date(0);
                const until = rule.valid_until ? new Date(rule.valid_until) : new Date('2099-12-31');
                if (now >= from && now <= until) return res.json({ granted: true, reason: 'time_based' });
            }
        }
        // Check if approved access request exists
        const approved = db.prepare("SELECT id FROM access_requests WHERE user_id = ? AND institution_id = ? AND status = 'approved'").get(req.user.id, req.params.instId);
        if (approved) return res.json({ granted: true, reason: 'approved_request' });

        res.json({ granted: false, reason: 'No matching access rule' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Request access
router.post('/:instId/request', verifyToken, (req, res) => {
    try {
        const { message } = req.body;
        const existing = db.prepare("SELECT id FROM access_requests WHERE user_id = ? AND institution_id = ? AND status = 'pending'").get(req.user.id, req.params.instId);
        if (existing) return res.status(409).json({ error: 'Request already pending' });
        const id = uuid();
        db.prepare('INSERT INTO access_requests (id, user_id, institution_id, message) VALUES (?, ?, ?, ?)').run(id, req.user.id, req.params.instId, message || '');
        res.status(201).json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get access requests for institution
router.get('/:instId/requests', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const requests = db.prepare(
            'SELECT ar.*, u.name as user_name, u.email as user_email FROM access_requests ar JOIN users u ON ar.user_id = u.id WHERE ar.institution_id = ? ORDER BY ar.created_at DESC'
        ).all(req.params.instId);
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Respond to access request
router.put('/request/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { status, reply } = req.body;
        db.prepare('UPDATE access_requests SET status = ?, reply = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, reply || '', req.params.id);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get my access requests (for user dashboard)
router.get('/my/requests', verifyToken, (req, res) => {
    try {
        const requests = db.prepare(
            'SELECT ar.*, i.name as institution_name FROM access_requests ar JOIN institutions i ON ar.institution_id = i.id WHERE ar.user_id = ? ORDER BY ar.created_at DESC'
        ).all(req.user.id);
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
