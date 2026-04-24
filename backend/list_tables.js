const {Pool}=require('pg');
const p=new Pool({host:'localhost',database:'safeg_ai',user:'safeg_user',password:'SafeG@DB2024!'});
p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name").then(r=>{console.log(r.rows.map(x=>x.table_name).join(', '));p.end()}).catch(e=>{console.log('Error:',e.message);p.end()});
