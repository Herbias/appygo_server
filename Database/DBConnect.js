var mysql = require("mysql");
var config = require("./Config.js");

var connection = mysql.createConnection(config);

module.exports = connection;
