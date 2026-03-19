// config/database.js
const { Pool, types } = require('pg');
const config = require('./index');

// Configure pg to parse BIGINT (OID 20, e.g. COUNT()) as integer
types.setTypeParser(20, function (val) {
  return parseInt(val, 10);
});

const pool = new Pool(config.database);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Set session timezone on connect to match app config
pool.on('connect', async (client) => {
  const offset = config.timezoneOffset;
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);

  try {
    // Postgres expects 'Asia/Shanghai' or 'Etc/GMT-8' (note GMT sign is inverted in Etc/GMT)
    if (offset === 8) {
      await client.query("SET TIME ZONE 'Asia/Shanghai'");
    } else {
      // Etc/GMT+8 is UTC-8, so we use the inverse sign for Etc/GMT
      const pgSign = offset >= 0 ? '-' : '+';
      await client.query(`SET TIME ZONE 'Etc/GMT${pgSign}${absOffset}'`);
    }
  } catch (err) {
    console.error('Error setting pg timezone:', err);
  }
});

/**
 * Replace SQLite-style ? placeholders with PG-style $1, $2, …
 */
function transformSql(sql) {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

// Bridge to maintain compatibility with sqlite3-style **and** Promise-style calls in models/routes.
const db = {
  /**
   * Fetch the first matching row.
   * Callback style: db.get(sql, [params], callback(err, row))
   * Promise style:  const row = await db.get(sql, [params])
   */
  async get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    if (params === undefined || params === null) params = [];

    const transformedSql = transformSql(sql);

    try {
      const res = await pool.query(transformedSql, params);
      const row = res.rows[0];

      if (typeof callback === 'function') {
        callback(null, row);
      } else {
        return row;
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback(err);
      } else {
        throw err;
      }
    }
  },

  /**
   * Execute a write query.
   * Callback style: db.run(sql, [params], callback(err))  – 'this' has {lastID, changes}
   * Promise style:  const {lastID, changes} = await db.run(sql, [params])
   */
  async run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    if (params === undefined || params === null) params = [];

    const transformedSql = transformSql(sql);

    try {
      const res = await pool.query(transformedSql, params);
      const result = {
        lastID: res.rows && res.rows[0] ? res.rows[0].id : null,
        changes: res.rowCount
      };

      if (typeof callback === 'function') {
        callback.call(result, null);
      } else {
        return result;
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback(err);
      } else {
        throw err;
      }
    }
  },

  /**
   * Fetch all matching rows.
   * Callback style: db.all(sql, [params], callback(err, rows))
   * Promise style:  const rows = await db.all(sql, [params])
   */
  async all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    if (params === undefined || params === null) params = [];

    const transformedSql = transformSql(sql);

    try {
      const res = await pool.query(transformedSql, params);
      const rows = res.rows;

      if (typeof callback === 'function') {
        callback(null, rows);
      } else {
        return rows;
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback(err);
      } else {
        throw err;
      }
    }
  },

  close(callback) {
    if (callback) {
      pool.end().then(() => callback()).catch(callback);
    } else {
      return pool.end();
    }
  },

  // Expose original pool for PG-specific queries if needed
  pool
};

console.log('PostgreSQL connection pool initialized');

module.exports = db;