import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import institutionRoutes from './routes/institutions.js';
import mapRoutes from './routes/maps.js';
import accessRoutes from './routes/access.js';
import navigationRoutes from './routes/navigation.js';
import analyticsRoutes from './routes/analytics.js';
import eventRoutes from './routes/events.js';
import adminRoutes from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/admin', adminRoutes);

// Serve static frontend files (Production)
const clientDistPath = join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All other routes should serve the index.html (SPA)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
    res.sendFile(join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🏢 Indoor Navigation Server running on http://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/health\n`);
});
