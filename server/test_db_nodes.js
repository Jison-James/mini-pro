
import db from './db/db.js';

console.log('Checking nodes table schema...');
const info = db.prepare('PRAGMA table_info(nodes)').all();
console.log(info);

console.log('Trying to select all nodes...');
try {
    const nodes = db.prepare('SELECT * FROM nodes').all();
    console.log(`Successfully fetched ${nodes.length} nodes.`);
} catch (e) {
    console.error('Select failed:', e);
}
