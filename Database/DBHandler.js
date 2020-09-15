var mysql = require("mysql");
var config = require("./Config.js");

var connection = mysql.createConnection(config);

var exports = (module.exports = {});

exports.Login = function (data, callback) {
  var sql = `Call GetUserLevel(?)`;
  var result = {};
  connection.query(sql, data.id_num, function (error, results, fields) {
    if (error) {
      console.log(error.message);
    } else {
      results[0].forEach((results) => {
        result = { user_level: results.user_level };
      });

      switch (result.user_level) {
        case "Student":
          sql = `Call GetUserDetails(?,?)`;

          connection.query(sql, [data.id_num, data.password], function (
            error,
            results,
            fields
          ) {
            if (error) {
              result = { success: "false" };
              return callback(result);
            }
            if (results.length) {
              results[0].forEach((results) => {
                result = {
                  success: "true",
                  id: results.user_id,
                  username: results.user_name,
                  userlevel: results.user_level_name,
                  id_number: results.user_id_number,
                  firstName: results.user_first_name,
                  middleName: results.user_middle_name,
                  lastName: results.user_last_name,
                  picture: results.user_picture,
                  department: results.user_department,
                  course: results.user_course,
                  yearLevel: results.user_year_level,
                };
              });
              return callback(result);
            } else {
              return callback({ success: "false" });
            }
          });
          break;
        case "Instructor":
          sql = `Call GetUserDetails(?, ?)`;

          connection.query(sql, [data.id_num, data.password], function (
            error,
            results,
            fields
          ) {
            if (error) {
              result = { success: "false" };
              return callback(result);
            }
            if (results.length) {
              results[0].forEach((results) => {
                result = {
                  success: "true",
                  id: results.user_id,
                  username: results.user_name,
                  userlevel: results.user_level_name,
                  id_number: results.user_id_number,
                  firstName: results.user_first_name,
                  middleName: results.user_middle_name,
                  lastName: results.user_last_name,
                  picture: results.user_picture,
                  department: results.user_department,
                };
              });
              return callback(result);
            } else {
              return callback({ success: "false" });
            }
          });
          break;
        default:
          break;
      }
    }
  });
};

exports.GetContacts = function (data, callback) {
  var sql = `Call GetContacts(?, ?)`;

  var result = { People: [] };

  connection.query(sql, [data.username, data.userlevel], function (
    error,
    results,
    fields
  ) {
    if (error) {
      console.log(error.message);
    }
    if (results.length) {
      for (var i = 0; i < results[0].length; i++) {
        var person = {
          username: results[0][i].username,
          userlevel: results[0][i].userlevel,
          firstname: results[0][i].firstname,
          middlename: results[0][i].middlename,
          lastname: results[0][i].lastname,
          picture: results[0][i].picture,
        };
        result.People.push(person);
      }
      return callback(result);
    } else {
      console.log("No results found!");
    }
  });
};

exports.GetMessage = async function (data, callback) {
  var sql = `Call GetMessage(?, ?)`;
  var result = [];

  connection.query(sql, [data.user1, data.user2], function (
    error,
    results,
    fields
  ) {
    if (error) {
      console.log(error.message);
    }
    if (results.length) {
      for (var i = 0; i < results[0].length; i++) {
        var message = {
          mail_id: results[0][i].mail_id,
          message_content: results[0][i].message_content,
          sender: results[0][i].sender,
          reciever: results[0][i].receiver,
          mail_sent_date: results[0][i].mail_sent_date,
        };
        result.push(message);
      }
      return callback(result);
    } else {
      console.log("No results found!");
    }
  });
};
//module.exports = "hello";
