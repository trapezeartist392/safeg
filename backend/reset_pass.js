const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const p = new Pool({ host:"localhost", database:"safeg_ai", user:"postgres", password:"SafeG@DB2024!" });
bcrypt.hash("Demo@SafeG2024", 10).then(hash => {
  return p.query("UPDATE users SET password_hash = $1 WHERE email = $2", [hash, "suresh@puneauto.com"]);
}).then(() => {
  console.log("Password updated");
  p.end();
}).catch(e => {
  console.log("Error:", e.message);
  p.end();
});
