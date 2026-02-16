import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/db.js';
import { verifyToken, requireRole, optionalAuth } from '../middleware/auth.js';
import { checkMapAccess } from '../middleware/access.js';

const router = Router();

// ---- NODES ----

// Get all nodes for a floor
router.get('/floors/:floorId/nodes', optionalAuth, (req, res) => {
    try {
        const floor = db.prepare('SELECT building_id FROM floors WHERE id = ?').get(req.params.floorId);
        if (!floor) return res.status(404).json({ error: 'Floor not found' });
        const building = db.prepare('SELECT institution_id FROM buildings WHERE id = ?').get(floor.building_id);
        req.params.instId = building.institution_id;

        // Manual check since we don't have instId in URL directly
        // Instead of middleware calling, we'll do quick verification
        // But for consistency, let's use a wrapper
        return checkMapAccess(req, res, () => {
            const nodes = db.prepare('SELECT * FROM nodes WHERE floor_id = ?').all(req.params.floorId);
            res.json(nodes);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create node
router.post('/floors/:floorId/nodes', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { name, x, y, node_type, is_selectable, description, connects_to_floor_id, connects_to_node_id, connects_to_building_id, metadata } = req.body;
        const id = uuid();
        const selectable = is_selectable !== undefined ? (is_selectable ? 1 : 0) : (node_type === 'hidden' ? 0 : 1);
        db.prepare(
            `INSERT INTO nodes (id, floor_id, name, x, y, node_type, is_selectable, description, connects_to_floor_id, connects_to_node_id, connects_to_building_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, req.params.floorId, name, x, y, node_type || 'normal', selectable, description || '', connects_to_floor_id || null, connects_to_node_id || null, connects_to_building_id || null, metadata ? JSON.stringify(metadata) : null);
        res.status(201).json({ id, name, x, y, node_type: node_type || 'normal' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update node
router.put('/nodes/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { name, x, y, node_type, is_selectable, description, connects_to_floor_id, connects_to_node_id, connects_to_building_id } = req.body;
        db.prepare(
            `UPDATE nodes SET name = COALESCE(?, name), x = COALESCE(?, x), y = COALESCE(?, y),
       node_type = COALESCE(?, node_type), is_selectable = COALESCE(?, is_selectable),
       description = COALESCE(?, description), connects_to_floor_id = COALESCE(?, connects_to_floor_id),
       connects_to_node_id = COALESCE(?, connects_to_node_id), connects_to_building_id = COALESCE(?, connects_to_building_id)
       WHERE id = ?`
        ).run(name, x, y, node_type, is_selectable !== undefined ? (is_selectable ? 1 : 0) : null, description, connects_to_floor_id, connects_to_node_id, connects_to_building_id, req.params.id);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete node
router.delete('/nodes/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        db.prepare('DELETE FROM edges WHERE from_node_id = ? OR to_node_id = ?').run(req.params.id, req.params.id);
        db.prepare('DELETE FROM nodes WHERE id = ?').run(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- EDGES ----

// Get all edges for a floor
router.get('/floors/:floorId/edges', optionalAuth, (req, res) => {
    try {
        const floor = db.prepare('SELECT building_id FROM floors WHERE id = ?').get(req.params.floorId);
        if (!floor) return res.status(404).json({ error: 'Floor not found' });
        const building = db.prepare('SELECT institution_id FROM buildings WHERE id = ?').get(floor.building_id);
        req.params.instId = building.institution_id;

        return checkMapAccess(req, res, () => {
            const edges = db.prepare('SELECT * FROM edges WHERE floor_id = ?').all(req.params.floorId);
            res.json(edges);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create edge
router.post('/floors/:floorId/edges', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { from_node_id, to_node_id, weight, is_stairs, is_elevator, is_wheelchair_accessible, is_restricted, is_outdoor, crowd_level, edge_type } = req.body;
        const id = uuid();
        db.prepare(
            `INSERT INTO edges (id, floor_id, from_node_id, to_node_id, weight, is_stairs, is_elevator, is_wheelchair_accessible, is_restricted, is_outdoor, crowd_level, edge_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, req.params.floorId, from_node_id, to_node_id, weight || 1.0, is_stairs ? 1 : 0, is_elevator ? 1 : 0, is_wheelchair_accessible !== false ? 1 : 0, is_restricted ? 1 : 0, is_outdoor ? 1 : 0, crowd_level || 0, edge_type || 'hallway');
        res.status(201).json({ id, from_node_id, to_node_id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update edge
router.put('/edges/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { weight, is_stairs, is_elevator, is_wheelchair_accessible, is_restricted, is_outdoor, crowd_level, edge_type } = req.body;
        db.prepare(
            `UPDATE edges SET weight = COALESCE(?, weight), is_stairs = COALESCE(?, is_stairs),
       is_elevator = COALESCE(?, is_elevator), is_wheelchair_accessible = COALESCE(?, is_wheelchair_accessible),
       is_restricted = COALESCE(?, is_restricted), is_outdoor = COALESCE(?, is_outdoor),
       crowd_level = COALESCE(?, crowd_level), edge_type = COALESCE(?, edge_type) WHERE id = ?`
        ).run(weight, is_stairs !== undefined ? (is_stairs ? 1 : 0) : null, is_elevator !== undefined ? (is_elevator ? 1 : 0) : null, is_wheelchair_accessible !== undefined ? (is_wheelchair_accessible ? 1 : 0) : null, is_restricted !== undefined ? (is_restricted ? 1 : 0) : null, is_outdoor !== undefined ? (is_outdoor ? 1 : 0) : null, crowd_level, edge_type, req.params.id);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete edge
router.delete('/edges/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        db.prepare('DELETE FROM edges WHERE id = ?').run(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- GRAPH DATA (combined nodes + edges) ----

router.get('/floors/:floorId/graph', (req, res) => {
    try {
        const nodes = db.prepare('SELECT * FROM nodes WHERE floor_id = ?').all(req.params.floorId);
        const edges = db.prepare('SELECT * FROM edges WHERE floor_id = ?').all(req.params.floorId);
        const floor = db.prepare('SELECT * FROM floors WHERE id = ?').get(req.params.floorId);
        res.json({ floor, nodes, edges });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get full institution graph (all buildings, floors, nodes, edges)
router.get('/institution/:instId/full-graph', optionalAuth, checkMapAccess, (req, res) => {
    try {
        const buildings = db.prepare('SELECT * FROM buildings WHERE institution_id = ? ORDER BY sort_order').all(req.params.instId);
        const result = buildings.map(b => {
            const floors = db.prepare('SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number').all(b.id);
            return {
                ...b,
                floors: floors.map(f => {
                    const nodes = db.prepare('SELECT * FROM nodes WHERE floor_id = ?').all(f.id);
                    const edges = db.prepare('SELECT * FROM edges WHERE floor_id = ?').all(f.id);
                    return { ...f, nodes, edges };
                })
            };
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- COMMENTS ----

router.get('/floors/:floorId/comments', (req, res) => {
    try {
        const comments = db.prepare(
            'SELECT mc.*, u.name as author_name FROM map_comments mc JOIN users u ON mc.user_id = u.id WHERE mc.floor_id = ? ORDER BY mc.created_at DESC'
        ).all(req.params.floorId);
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/floors/:floorId/comments', verifyToken, (req, res) => {
    try {
        const { content, comment_type, x, y, node_id } = req.body;
        const id = uuid();
        db.prepare(
            'INSERT INTO map_comments (id, node_id, floor_id, user_id, comment_type, content, x, y) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, node_id || null, req.params.floorId, req.user.id, comment_type || 'comment', content, x || null, y || null);
        res.status(201).json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- FEEDBACK ----

router.post('/institution/:instId/feedback', verifyToken, (req, res) => {
    try {
        const { rating, comment } = req.body;
        const id = uuid();
        db.prepare('INSERT INTO feedback (id, user_id, institution_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(id, req.user.id, req.params.instId, rating, comment || '');
        res.status(201).json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/institution/:instId/feedback', (req, res) => {
    try {
        const fb = db.prepare('SELECT f.*, u.name as author_name FROM feedback f JOIN users u ON f.user_id = u.id WHERE f.institution_id = ? ORDER BY f.created_at DESC').all(req.params.instId);
        res.json(fb);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- SAVED MAPS ----

router.get('/saved', verifyToken, (req, res) => {
    try {
        const saved = db.prepare(
            'SELECT sm.*, i.name as institution_name FROM saved_maps sm JOIN institutions i ON sm.institution_id = i.id WHERE sm.user_id = ? ORDER BY sm.created_at DESC'
        ).all(req.user.id);
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/save/:instId', verifyToken, (req, res) => {
    try {
        const existing = db.prepare('SELECT id FROM saved_maps WHERE user_id = ? AND institution_id = ?').get(req.user.id, req.params.instId);
        if (existing) return res.json({ message: 'Already saved' });
        const id = uuid();
        db.prepare('INSERT INTO saved_maps (id, user_id, institution_id) VALUES (?, ?, ?)').run(id, req.user.id, req.params.instId);
        res.status(201).json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/save/:instId', verifyToken, (req, res) => {
    try {
        db.prepare('DELETE FROM saved_maps WHERE user_id = ? AND institution_id = ?').run(req.user.id, req.params.instId);
        res.json({ message: 'Removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- NAVIGATION HISTORY ----

router.get('/history', verifyToken, (req, res) => {
    try {
        const history = db.prepare(
            'SELECT h.*, i.name as institution_name FROM user_map_history h JOIN institutions i ON h.institution_id = i.id WHERE h.user_id = ? ORDER BY h.created_at DESC LIMIT 50'
        ).all(req.user.id);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/history', verifyToken, (req, res) => {
    try {
        const { institution_id, from_node_id, to_node_id, route_mode } = req.body;
        const id = uuid();
        db.prepare('INSERT INTO user_map_history (id, user_id, institution_id, from_node_id, to_node_id, route_mode) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.user.id, institution_id, from_node_id || null, to_node_id || null, route_mode || 'shortest');
        res.status(201).json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
