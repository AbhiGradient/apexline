require('dotenv').config();
const mysql = require('mysql2/promise');

const ca = process.env.DB_CA ? process.env.DB_CA.replace(/\\n/g, '\n') : undefined;

const ssl =
  process.env.DB_SSL === 'true'
    ? { minVersion: 'TLSv1.2', ca, rejectUnauthorized: process.env.DB_SSL_STRICT !== 'false' }
    : undefined;

const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'apexline',
  connectTimeout: 20000,
  ssl
};

const pool = mysql.createPool({
  ...baseConfig,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || 5,
  queueLimit: 0,
  charset: 'utf8mb4',
  decimalNumbers: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

const query = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

module.exports = { pool, query, baseConfig };