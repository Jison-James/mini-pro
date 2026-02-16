
import db from './db/db.js';

console.log('Starting migration...');

try {
    // 1. Add main_map_url to institutions
    try {
        const check = db.prepare("SELECT main_map_url FROM institutions LIMIT 1");
        check.get();
        console.log('✓ main_map_url already exists in institutions');
    } catch (e) {
        db.prepare('ALTER TABLE institutions ADD COLUMN main_map_url TEXT').run();
        console.log('✓ Added main_map_url to institutions');
    }

    // 2. Update nodes table to support 'outdoor' type
    // Check if 'outdoor' is already in the check constraint? Hard to check via SQL.
    // We'll just recreate to be safe.

    console.log('Migrating nodes table...');

    db.exec(`PRAGMA foreign_keys=OFF;`);

    // Begin transaction
    const updateNodes = db.transaction(() => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS nodes_new (
              id TEXT PRIMARY KEY,
              floor_id TEXT NOT NULL,
              name TEXT NOT NULL,
              x REAL NOT NULL,
              y REAL NOT NULL,
              node_type TEXT NOT NULL DEFAULT 'normal' CHECK(node_type IN ('normal','hidden','connector','stairs','elevator','ramp','emergency_exit','restricted','outdoor')),
              is_selectable INTEGER DEFAULT 1,
              description TEXT,
              connects_to_floor_id TEXT,
              connects_to_node_id TEXT,
              connects_to_building_id TEXT,
              metadata TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE,
              FOREIGN KEY (connects_to_floor_id) REFERENCES floors(id),
              FOREIGN KEY (connects_to_node_id) REFERENCES nodes(id)
            );
        `);

        // Check if nodes table exists
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'").get();
        if (tableExists) {
            db.exec(`INSERT INTO nodes_new SELECT * FROM nodes;`);
            db.exec(`DROP TABLE nodes;`);
        }

        db.exec(`ALTER TABLE nodes_new RENAME TO nodes;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_floor ON nodes(floor_id);`);
    });

    updateNodes();

    db.exec(`PRAGMA foreign_keys=ON;`);

    console.log('✓ Nodes table migrated successfully');

} catch (err) {
    console.error('Migration failed:', err);
    console.error(err);
    process.exit(1);
}

console.log('Migration completed successfully.');
