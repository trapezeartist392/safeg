const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', database: 'safeg_ai',
  user: 'postgres', password: 'SafeG@DB2024!'
});
pool.query("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_email_sent TEXT[] DEFAULT '{}'")
  .then(() => { console.log('Done'); pool.end(); })
  .catch(e => { console.log('Error:', e.message); pool.end(); });
