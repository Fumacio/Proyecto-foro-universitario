// Convierte en admin a un usuario ya registrado.
// Uso: npm run make-admin -- usuario@email.com
const pool = require('../db/connection');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Uso: npm run make-admin -- usuario@email.com');
    process.exitCode = 1;
    return;
  }

  const [result] = await pool.query(
    "UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'admin') WHERE email = ?",
    [email]
  );

  if (result.affectedRows === 0) {
    console.error(`No hay ningún usuario registrado con el email ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`${email} ahora es admin.`);
  }
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
