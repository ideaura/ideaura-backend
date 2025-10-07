const db = require('../config/database');

class Room {
  static create(roomData) {
    return new Promise((resolve, reject) => {
      const { name, description } = roomData;
      
      db.run(
        "INSERT INTO rooms (name, description) VALUES (?, ?)",
        [name, description],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT r.* 
         FROM rooms r
         ORDER BY r.name`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  static findByName(name) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id FROM rooms WHERE name = ?",
        [name],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM rooms WHERE id = ?",
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }
}

module.exports = Room;