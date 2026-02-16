import { Router } from 'express';
import db from '../db/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Get all users
router.get('/users', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const users = db.prepare('SELECT id, email, name, role, department, created_at FROM users ORDER BY created_at DESC').all();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update user role
router.put('/users/:id/role', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['user', 'institution', 'admin', 'event_organizer'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
        db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, req.params.id);
        res.json({ message: 'Role updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete user (cascade)
router.delete('/users/:id', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const userId = req.params.id;
        // Prevent admin from deleting themselves
        if (userId === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

        const deleteUser = db.transaction(() => {
            // Delete all institutions owned by this user (and their children)
            const ownedInsts = db.prepare('SELECT id FROM institutions WHERE owner_id = ?').all(userId);
            for (const inst of ownedInsts) {
                deleteInstitutionCascade(inst.id);
            }
            // Delete user's related records
            db.prepare('DELETE FROM feedback WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM map_comments WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM saved_maps WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM user_map_history WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM navigation_logs WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM access_requests WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM events WHERE organizer_id = ?').run(userId);
            // Finally delete the user
            db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        });
        deleteUser();
        res.json({ message: 'User and all related data deleted' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all institutions (including unpublished)
router.get('/institutions', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const institutions = db.prepare('SELECT i.*, u.name as owner_name FROM institutions i JOIN users u ON i.owner_id = u.id ORDER BY i.created_at DESC').all();
        res.json(institutions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Moderate institution (publish/unpublish)
router.put('/institutions/:id/moderate', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const { is_published } = req.body;
        db.prepare('UPDATE institutions SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(is_published ? 1 : 0, req.params.id);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper: cascade delete an institution and all its children
function deleteInstitutionCascade(instId) {
    // Get all buildings -> floors for this institution
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
    db.prepare('DELETE FROM institutions WHERE id = ?').run(instId);
}

// Delete institution (cascade)
router.delete('/institutions/:id', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const deleteTx = db.transaction(() => {
            deleteInstitutionCascade(req.params.id);
        });
        deleteTx();
        res.json({ message: 'Institution and all related data deleted' });
    } catch (err) {
        console.error('Delete institution error:', err);
        res.status(500).json({ error: err.message });
    }
});

// System-wide analytics
router.get('/analytics', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        const instCount = db.prepare('SELECT COUNT(*) as count FROM institutions').get();
        const navCount = db.prepare('SELECT COUNT(*) as count FROM navigation_logs').get();
        const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get();

        const usersByRole = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all();
        const recentUsers = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 10').all();
        const recentNavs = db.prepare(
            `SELECT nl.*, i.name as institution_name FROM navigation_logs nl
       LEFT JOIN institutions i ON nl.institution_id = i.id ORDER BY nl.created_at DESC LIMIT 20`
        ).all();

        const dailyNavs = db.prepare(
            `SELECT DATE(created_at) as date, COUNT(*) as count FROM navigation_logs
       WHERE created_at >= DATE('now', '-30 days') GROUP BY date ORDER BY date`
        ).all();

        res.json({
            totals: { users: userCount.count, institutions: instCount.count, navigations: navCount.count, events: eventCount.count },
            usersByRole,
            recentUsers,
            recentNavs,
            dailyNavs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
