var mysql = require('mysql');
var config = require('./config.js');

var connection = mysql.createConnection(config);

module.exports = connection;
