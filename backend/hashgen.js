const bcrypt = require('bcryptjs');
const password = 'Demo@SafeG2024!';
bcrypt.hash(password, 12).then(h => {
  console.log(h);
  process.exit();
});
