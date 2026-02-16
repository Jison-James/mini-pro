
import db from '../server/db/db.js';

console.log('Starting migration...');

try {
    // 1. Add main_map_url to institutions if it doesn't exist
    try {
        db.prepare('ALTER TABLE institutions ADD COLUMN main_map_url TEXT').run();
        console.log('✓ Added main_map_url to institutions');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('✓ main_map_url already exists in institutions');
        } else {
            throw e;
        }
    }

    // 2. Update nodes table to support 'outdoor' type
    // We need to recreate the table because SQLite doesn't support altering CHECK constraints

    console.log('Migrating nodes table...');

    db.exec(`PRAGMA foreign_keys=OFF;`);

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

    // Copy data
    db.exec(`
        INSERT INTO nodes_new SELECT * FROM nodes;
    `);

    // Drop old table and rename new one
    db.exec(`DROP TABLE nodes;`);
    db.exec(`ALTER TABLE nodes_new RENAME TO nodes;`);

    // Re-create index
    db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_floor ON nodes(floor_id);`);

    db.exec(`PRAGMA foreign_keys=ON;`);

    console.log('✓ Nodes table migrated successfully');

} catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
}

console.log('Migration completed successfully.');
