import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/db.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Log a navigation event
router.post('/log', optionalAuth, (req, res) => {
    try {
        const { institution_id, from_node_name, to_node_name, route_mode, path_nodes, duration_ms, searched_term } = req.body;
        const id = uuid();
        db.prepare(
            `INSERT INTO navigation_logs (id, user_id, institution_id, from_node_name, to_node_name, route_mode, path_nodes, duration_ms, searched_term)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, req.user?.id || null, institution_id, from_node_name || '', to_node_name || '', route_mode || 'shortest', path_nodes ? JSON.stringify(path_nodes) : null, duration_ms || null, searched_term || null);
        res.status(201).json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Search nodes across institution
router.get('/search/:instId', (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);
        const nodes = db.prepare(
            `SELECT n.*, f.floor_number, f.name as floor_name, b.name as building_name, b.id as building_id
       FROM nodes n
       JOIN floors f ON n.floor_id = f.id
       JOIN buildings b ON f.building_id = b.id
       WHERE b.institution_id = ? AND n.is_selectable = 1 AND n.name LIKE ?
       ORDER BY n.name`
        ).all(req.params.instId, `%${q}%`);
        res.json(nodes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
