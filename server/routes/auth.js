import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../db/db.js';
import { JWT_SECRET, verifyToken } from '../middleware/auth.js';

const router = Router();

// Register
router.post('/register', (req, res) => {
    try {
        const { email, password, name, role = 'user' } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }
        const validRoles = ['user', 'institution', 'event_organizer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) return res.status(409).json({ error: 'Email already registered' });

        const id = uuid();
        const password_hash = bcrypt.hashSync(password, 10);
        db.prepare(
            'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
        ).run(id, email, password_hash, name, role);

        const token = jwt.sign({ id, email, name, role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id, email, name, role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get profile
router.get('/profile', verifyToken, (req, res) => {
    try {
        const user = db.prepare('SELECT id, email, name, role, avatar_url, department, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update profile
router.put('/profile', verifyToken, (req, res) => {
    try {
        const { name, department, avatar_url } = req.body;
        db.prepare('UPDATE users SET name = COALESCE(?, name), department = COALESCE(?, department), avatar_url = COALESCE(?, avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(name, department, avatar_url, req.user.id);
        res.json({ message: 'Profile updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
