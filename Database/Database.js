const mysql = require("mysql");
var config = require("./config.js");

module.exports = class Database {
  constructor() {
    this.connection = mysql.createConnection(config);
  }

  query(sql, args) {
    return new Promise((resolve, reject) => {
      this.connection.query(sql, args, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.connection.end((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static Execute(callback) {
    const database = new Database();
    return callback(database).then(
      (result) => database.close().then(() => result),
      (err) =>
        database.close().then(() => {
          throw err;
        })
    );
  }
};
