import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/db.js';
import { verifyToken, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Get all published events
router.get('/', (req, res) => {
    try {
        const { search, institution_id } = req.query;
        let query = "SELECT e.*, i.name as institution_name, u.name as organizer_name FROM events e LEFT JOIN institutions i ON e.institution_id = i.id JOIN users u ON e.organizer_id = u.id WHERE e.is_published = 1";
        const params = [];
        if (search) {
            query += ' AND (e.title LIKE ? OR e.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (institution_id) {
            query += ' AND e.institution_id = ?';
            params.push(institution_id);
        }
        query += ' ORDER BY e.event_date DESC';
        const events = db.prepare(query).all(...params);
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// IMPORTANT: /my/list must be defined BEFORE /:id
router.get('/my/list', verifyToken, (req, res) => {
    try {
        const events = db.prepare('SELECT * FROM events WHERE organizer_id = ? ORDER BY event_date DESC').all(req.user.id);
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single event
router.get('/:id', (req, res) => {
    try {
        const event = db.prepare(
            'SELECT e.*, i.name as institution_name, u.name as organizer_name FROM events e LEFT JOIN institutions i ON e.institution_id = i.id JOIN users u ON e.organizer_id = u.id WHERE e.id = ?'
        ).get(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create event
router.post('/', verifyToken, requireRole('event_organizer', 'institution', 'admin'), (req, res) => {
    try {
        const { title, description, institution_id, building_id, floor_id, node_id, event_date, end_date, latitude, longitude } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });
        const id = uuid();
        db.prepare(
            `INSERT INTO events (id, title, description, institution_id, building_id, floor_id, node_id, organizer_id, event_date, end_date, latitude, longitude, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        ).run(id, title, description || '', institution_id || null, building_id || null, floor_id || null, node_id || null, req.user.id, event_date || null, end_date || null, latitude || null, longitude || null);
        res.status(201).json({ id, title });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update event
router.put('/:id', verifyToken, requireRole('event_organizer', 'institution', 'admin'), (req, res) => {
    try {
        const { title, description, event_date, end_date, is_published, institution_id, building_id, floor_id, node_id } = req.body;
        db.prepare(
            `UPDATE events SET title = COALESCE(?, title), description = COALESCE(?, description),
       event_date = COALESCE(?, event_date), end_date = COALESCE(?, end_date),
       is_published = COALESCE(?, is_published), institution_id = COALESCE(?, institution_id),
       building_id = COALESCE(?, building_id), floor_id = COALESCE(?, floor_id),
       node_id = COALESCE(?, node_id) WHERE id = ? AND organizer_id = ?`
        ).run(title, description, event_date, end_date, is_published, institution_id, building_id, floor_id, node_id, req.params.id, req.user.id);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete event
router.delete('/:id', verifyToken, requireRole('event_organizer', 'institution', 'admin'), (req, res) => {
    try {
        db.prepare('DELETE FROM events WHERE id = ? AND organizer_id = ?').run(req.params.id, req.user.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
