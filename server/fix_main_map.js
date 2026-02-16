
import db from './db/db.js';

const institutionId = '2f0087b7-0099-4c75-95be-948b9ed13a78';
const url = '/uploads/overview_placeholder.svg';

try {
    const result = db.prepare('UPDATE institutions SET main_map_url = ? WHERE id = ?').run(url, institutionId);
    console.log('Update result:', result);

    const inst = db.prepare('SELECT id, name, main_map_url FROM institutions WHERE id = ?').get(institutionId);
    console.log('Updated institution:', inst);
} catch (e) {
    console.error('Update failed:', e);
}
