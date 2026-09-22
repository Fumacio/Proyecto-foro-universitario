const path = require('path');
const mysql = require('mysql2/promise');

// Asegurar .env de la raíz aunque este módulo se cargue sin pasar por server.js
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;

if (!DB_HOST || !DB_USER || !DB_NAME) {
  throw new Error(
    'Faltan variables de entorno de base de datos (DB_HOST, DB_USER, DB_NAME). ' +
      'Revisá que exista el archivo .env en la raíz del proyecto (copia de .env.example).'
  );
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS || '',
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
