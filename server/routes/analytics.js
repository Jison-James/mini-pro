import { Router } from 'express';
import db from '../db/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Institution analytics
router.get('/:instId', verifyToken, requireRole('institution', 'admin'), (req, res) => {
    try {
        const instId = req.params.instId;

        // Most searched rooms
        const mostSearched = db.prepare(
            `SELECT to_node_name as room, COUNT(*) as count FROM navigation_logs
       WHERE institution_id = ? AND to_node_name != '' GROUP BY to_node_name ORDER BY count DESC LIMIT 10`
        ).all(instId);

        // Most used paths
        const mostUsedPaths = db.prepare(
            `SELECT from_node_name, to_node_name, COUNT(*) as count FROM navigation_logs
       WHERE institution_id = ? AND from_node_name != '' AND to_node_name != ''
       GROUP BY from_node_name, to_node_name ORDER BY count DESC LIMIT 10`
        ).all(instId);

        // Peak hours
        const peakHours = db.prepare(
            `SELECT strftime('%H', created_at) as hour, COUNT(*) as count FROM navigation_logs
       WHERE institution_id = ? GROUP BY hour ORDER BY hour`
        ).all(instId);

        // Route mode usage
        const routeModes = db.prepare(
            `SELECT route_mode, COUNT(*) as count FROM navigation_logs
       WHERE institution_id = ? GROUP BY route_mode ORDER BY count DESC`
        ).all(instId);

        // Daily navigation count (last 30 days)
        const dailyCount = db.prepare(
            `SELECT DATE(created_at) as date, COUNT(*) as count FROM navigation_logs
       WHERE institution_id = ? AND created_at >= DATE('now', '-30 days')
       GROUP BY date ORDER BY date`
        ).all(instId);

        // Total navigations
        const total = db.prepare('SELECT COUNT(*) as count FROM navigation_logs WHERE institution_id = ?').get(instId);

        // Search terms
        const searchTerms = db.prepare(
            `SELECT searched_term, COUNT(*) as count FROM navigation_logs
       WHERE institution_id = ? AND searched_term IS NOT NULL AND searched_term != ''
       GROUP BY searched_term ORDER BY count DESC LIMIT 10`
        ).all(instId);

        res.json({
            mostSearched,
            mostUsedPaths,
            peakHours,
            routeModes,
            dailyCount,
            totalNavigations: total.count,
            searchTerms
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
