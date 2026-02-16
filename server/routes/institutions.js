import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db/db.js';
import { verifyToken, requireRole, optionalAuth } from '../middleware/auth.js';
import { checkMapAccess } from '../middleware/access.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// Multer config for floor plan uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, join(__dirname, '..', 'uploads')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ---- INSTITUTIONS ----

// Get all published institutions (public)
router.get('/', (req, res) => {
    try {
        const { search, lat, lng, radius } = req.query;
        let query = 'SELECT * FROM institutions WHERE is_published = 1';
        const params = [];
        if (search) {
            query += ' AND (name LIKE ? OR address LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (lat && lng && radius) {
            const r = parseFloat(radius) / 111;
            query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
            params.push(parseFloat(lat) - r, parseFloat(lat) + r, parseFloat(lng) - r, parseFloat(lng) + r);
        }
        const institutions = db.prepare(query).all(...params);
        res.json(institutions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// IMPORTANT: /my/list must be defined BEFORE /:id to prevent Express matching "my" as an id
router.get('/my/list', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const list = db.prepare('SELECT * FROM institutions WHERE owner_id = ?').all(req.user.id);
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single institution
router.get('/:id', optionalAuth, checkMapAccess, (req, res) => {
    try {
        const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.params.id);
        if (!inst) return res.status(404).json({ error: 'Institution not found' });
        res.json(inst);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create institution
router.post('/', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { name, description, address, latitude, longitude, website, contact_email, contact_phone } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const id = uuid();
        db.prepare(
            `INSERT INTO institutions (id, name, description, address, latitude, longitude, website, contact_email, contact_phone, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, name, description || '', address || '', latitude || null, longitude || null, website || '', contact_email || '', contact_phone || '', req.user.id);
        res.status(201).json({ id, name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update institution
// Update institution
router.put('/:id', verifyToken, requireRole('institution', 'admin'), upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'main_map', maxCount: 1 }
]), (req, res) => {
    try {
        console.log('Update Institution Request:', req.params.id);
        console.log('Files:', req.files);
        console.log('Body:', req.body);
        const { name, description, address, latitude, longitude, website, contact_email, contact_phone, is_published } = req.body;

        let logo_url = undefined;
        let cover_url = undefined;
        let main_map_url = undefined;

        if (req.files?.logo) logo_url = `/uploads/${req.files.logo[0].filename}`;
        if (req.files?.cover) cover_url = `/uploads/${req.files.cover[0].filename}`;
        if (req.files?.main_map) main_map_url = `/uploads/${req.files.main_map[0].filename}`;

        db.prepare(
            `UPDATE institutions SET 
                name = COALESCE(?, name), 
                description = COALESCE(?, description),
                address = COALESCE(?, address), 
                latitude = COALESCE(?, latitude), 
                longitude = COALESCE(?, longitude),
                website = COALESCE(?, website), 
                contact_email = COALESCE(?, contact_email),
                contact_phone = COALESCE(?, contact_phone), 
                is_published = COALESCE(?, is_published),
                logo_url = COALESCE(?, logo_url),
                cover_url = COALESCE(?, cover_url),
                main_map_url = COALESCE(?, main_map_url),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND owner_id = ?`
        ).run(
            name, description, address, latitude, longitude, website, contact_email, contact_phone, is_published,
            logo_url, cover_url, main_map_url,
            req.params.id, req.user.id
        );
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete institution (cascade)
router.delete('/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const instId = req.params.id;
        const deleteTx = db.transaction(() => {
            const buildings = db.prepare('SELECT id FROM buildings WHERE institution_id = ?').all(instId);
            for (const b of buildings) {
                const floors = db.prepare('SELECT id FROM floors WHERE building_id = ?').all(b.id);
                for (const f of floors) {
                    db.prepare('DELETE FROM edges WHERE floor_id = ?').run(f.id);
                    db.prepare('DELETE FROM nodes WHERE floor_id = ?').run(f.id);
                    db.prepare('DELETE FROM map_comments WHERE floor_id = ?').run(f.id);
                }
                db.prepare('DELETE FROM floors WHERE building_id = ?').run(b.id);
            }
            db.prepare('DELETE FROM buildings WHERE institution_id = ?').run(instId);
            db.prepare('DELETE FROM map_access WHERE institution_id = ?').run(instId);
            db.prepare('DELETE FROM access_requests WHERE institution_id = ?').run(instId);
            db.prepare('DELETE FROM feedback WHERE institution_id = ?').run(instId);
            db.prepare('DELETE FROM saved_maps WHERE institution_id = ?').run(instId);
            db.prepare('DELETE FROM navigation_logs WHERE institution_id = ?').run(instId);
            db.prepare('DELETE FROM events WHERE institution_id = ?').run(instId);
            db.prepare('DELETE FROM institutions WHERE id = ? AND owner_id = ?').run(instId, req.user.id);
        });
        deleteTx();
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('Delete institution error:', err);
        res.status(500).json({ error: err.message });
    }
});


// ---- BUILDINGS ----

router.get('/:instId/buildings', (req, res) => {
    try {
        const buildings = db.prepare('SELECT * FROM buildings WHERE institution_id = ? ORDER BY sort_order').all(req.params.instId);
        res.json(buildings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:instId/buildings', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { name, building_code, building_type, description, floor_count } = req.body;
        const id = uuid();
        db.prepare(
            'INSERT INTO buildings (id, institution_id, name, building_code, building_type, description, floor_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(id, req.params.instId, name, building_code || '', building_type || 'academic', description || '', floor_count || 1);
        res.status(201).json({ id, name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/buildings/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const { name, building_code, building_type, description, floor_count } = req.body;
        db.prepare(
            'UPDATE buildings SET name = COALESCE(?, name), building_code = COALESCE(?, building_code), building_type = COALESCE(?, building_type), description = COALESCE(?, description), floor_count = COALESCE(?, floor_count) WHERE id = ?'
        ).run(name, building_code, building_type, description, floor_count, req.params.id);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/buildings/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const bId = req.params.id;
        const deleteTx = db.transaction(() => {
            const floors = db.prepare('SELECT id FROM floors WHERE building_id = ?').all(bId);
            for (const f of floors) {
                db.prepare('DELETE FROM edges WHERE floor_id = ?').run(f.id);
                db.prepare('DELETE FROM nodes WHERE floor_id = ?').run(f.id);
                db.prepare('DELETE FROM map_comments WHERE floor_id = ?').run(f.id);
            }
            db.prepare('DELETE FROM floors WHERE building_id = ?').run(bId);
            db.prepare('DELETE FROM buildings WHERE id = ?').run(bId);
        });
        deleteTx();
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- FLOORS ----

router.get('/buildings/:buildingId/floors', (req, res) => {
    try {
        const floors = db.prepare('SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number').all(req.params.buildingId);
        res.json(floors);
    } catch (err) {
        console.error('GET floors error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/buildings/:buildingId/floors', verifyToken, requireRole('institution', 'admin'), upload.single('image'), (req, res) => {
    try {
        const { floor_number, name } = req.body;
        const id = uuid();
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;
        db.prepare(
            'INSERT INTO floors (id, building_id, floor_number, name, image_url) VALUES (?, ?, ?, ?, ?)'
        ).run(id, req.params.buildingId, parseInt(floor_number) || 0, name || `Floor ${floor_number}`, image_url);
        res.status(201).json({ id, floor_number, name: name || `Floor ${floor_number}`, image_url });
    } catch (err) {
        console.error('POST floor error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/floors/:id/image', verifyToken, requireRole('institution', 'admin'), upload.single('image'), (req, res) => {
    try {
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;
        if (image_url) {
            db.prepare('UPDATE floors SET image_url = ? WHERE id = ?').run(image_url, req.params.id);
        }
        res.json({ image_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/floors/:id', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const fId = req.params.id;
        const deleteTx = db.transaction(() => {
            db.prepare('DELETE FROM edges WHERE floor_id = ?').run(fId);
            db.prepare('DELETE FROM nodes WHERE floor_id = ?').run(fId);
            db.prepare('DELETE FROM map_comments WHERE floor_id = ?').run(fId);
            db.prepare('DELETE FROM floors WHERE id = ?').run(fId);
        });
        deleteTx();
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
