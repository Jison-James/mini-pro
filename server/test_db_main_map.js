
import db from './db/db.js';

console.log('Checking institutions table...');
try {
    const insts = db.prepare('SELECT id, name, main_map_url FROM institutions').all();
    console.log(JSON.stringify(insts, null, 2));
} catch (e) {
    console.error('Select failed:', e);
}
