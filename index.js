var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var bodyParser = require("body-parser");

const port = process.env.PORT || 3001;

var cors = require("cors");
var Database = require("./Database/Database.js");
const { database, user } = require("./Database/config.js");
const { randomBytes } = require("crypto");
const { cpuUsage } = require("process");
const { json } = require("body-parser");

Database.execute = function (callback) {
  const database = new Database();
  return callback(database).then(
    (result) => database.close().then(() => result),
    (err) =>
      database.close().then(() => {
        throw err;
      })
  );
};

app.use(cors());
app.use(bodyParser.json());

// let visitor = 0;
let visitor = 0;

Database.Execute((database) =>
  database
    .query("SELECT COUNT(*) as `count` FROM visitor")
    .then(async (rows) => {
      visitor = rows[0].count;
    })
);

app.get("/get/product/detail", async (req, res) => {
  const { category, id, brand } = req.query;
  let filters = await Database.Execute((database) =>
    database
      .query(
        `select filters.id, category.name, filters.table from filters join category on category.id = filters.category where name = "${category}"`
      )
      .then((rows) => {
        return JSON.parse(JSON.stringify(rows));
      })
      .catch((err) => {
        console.log(err);
      })
  );

  var a = [];
  filters.forEach((obj) => {
    a.push(`join ${obj.table} on ${obj.table}.id = ${category}.${obj.table}`);
  });

  var b = [];
  filters.forEach((obj) => {
    b.push(`${obj.table}.name as ${obj.table}`);
  });

  var c = `select ${category}.id, ${category}.name, ${category}.price, image.name as image, category.id as categoryId, category.name as categoryName, ${b.join(
    ", "
  )} from ${category} join image on image.id = ${category}.image join category on category.id = ${category}.category ${a.join(
    " "
  )} WHERE ${category}.id = ${id}`;

  const product = await Database.Execute((database) =>
    database
      .query(c)
      .then((rows) => {
        return JSON.parse(JSON.stringify(rows));
      })
      .catch((err) => {
        return;
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json({ product, filters });
});

app.get("/get/product/:category", async (req, res) => {
  //================================
  //         NOTE
  //================================
  // category = table name

  const { category } = req.params;
  const query = req.query;

  let filters = await Database.Execute((database) =>
    database
      .query(
        `select filters.id, category.name, filters.table from filters join category on category.id = filters.category where name = "${category}"`
      )
      .then((rows) => {
        return JSON.parse(JSON.stringify(rows));
      })
      .catch((err) => {
        console.log(err);
      })
  );

  var a = [];
  filters.forEach((obj) => {
    a.push(`join ${obj.table} on ${obj.table}.id = ${category}.${obj.table}`);
  });

  var b = [];
  filters.forEach((obj) => {
    b.push(`${obj.table}.name as ${obj.table}`);
  });

  var c = `select ${category}.id, ${category}.name, ${category}.price, image.name as image, category.id as categoryId, category.name as categoryName, ${b.join(
    ", "
  )} from ${category} join image on image.id = ${category}.image join category on category.id = ${category}.category ${a.join(
    " "
  )}`;

  var d = [];
  Object.keys(query).forEach((key) => {
    if (key == "sort" || key == "search") return;

    d.push(key + ".name = " + `\'${req.query[key]}\'`);
  });

  if (query["search"]) d.push(`${category}.name LIKE \'%${query["search"]}%\'`);

  var statement = d.length != 0 ? `${c} where ${d.join(" and ")}` : c;

  let orderBy = query.sort && query.sort == "High to Low" ? "desc" : "asc";

  Database.Execute((database) =>
    database
      .query(
        query["sort"]
          ? statement + ` ORDER BY ${category}.price ${orderBy}`
          : statement
      )
      .then((rows) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.send(rows);
      })
      .catch((err) => {
        return;
      })
  );
});

app.get("/get/products/filters/:category", async (req, res) => {
  const { category } = req.params;

  let filters = await Database.Execute((database) =>
    database
      .query(
        `select filters.id, category.name, filters.table from filters join category on category.id = filters.category where name = "${category}"`
      )
      .then((rows) => {
        return JSON.parse(JSON.stringify(rows));
      })
      .catch((err) => console.log(err))
  );

  let a = [];
  let b = [];

  filters.map(async (filter) => {
    let stmt = `SELECT DISTINCT(${filter.table}.id), ${filter.table}.name FROM ${category} JOIN ${filter.table} ON ${filter.table}.id = ${category}.${filter.table}`;
    a.push(stmt);
  });

  a.forEach(async (stmt) => {
    b.push(
      Database.Execute((database) =>
        database.query(stmt).then((rows) => {
          return JSON.parse(JSON.stringify(rows));
        })
      )
    );
  });

  let c = await Promise.all(b).then((data) => {
    return data;
  });

  let d = {};
  for (var i = 0; i < filters.length; i++) {
    d[filters[i].table] = c[i];
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(d);
});

app.post("/add/cart/", async (req, res) => {
  const { user, categoryId, id, quantity } = req.body.data;

  if (quantity < 1) return;

  isExist = await Database.Execute((database) =>
    database
      .query(
        `SELECT DISTINCT(id), quantity FROM wishlist WHERE product = ${id} AND userid = ${user.id} AND userType = \'${user.type}\' AND  category = ${categoryId} AND deleted = 0;`
      )
      .then((result) => {
        return JSON.parse(JSON.stringify(result));
      })
  );

  const newQuantity =
    isExist.length > 0
      ? parseInt(isExist[0].quantity) + parseInt(quantity)
      : null;

  if (isExist.length > 0)
    await Database.Execute((database) =>
      database.query(
        `UPDATE wishlist SET quantity = ${
          parseInt(isExist[0].quantity) + parseInt(quantity)
        } WHERE id = ${isExist[0].id};`
      )
    );
  else
    await Database.Execute((database) =>
      database.query(
        `INSERT INTO wishlist(id, userid, category, product, quantity, userType, deleted) VALUES('', ${user.id}, ${categoryId}, ${id}, ${quantity}, \'${user.type}\', '') `
      )
    );

  const count = await Database.Execute((database) =>
    database
      .query(
        `SELECT count(DISTINCT(product)) as wishlistItems FROM wishlist where userid = ${user.id} and userType = '${user.type}' AND deleted = 0 `
      )
      .then((rows) => {
        return rows[0].wishlistItems;
      })
  );
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(count);
});

app.post("/update/personalinformation", async (req, res) => {
  const {
    userid,
    firstName,
    middleName,
    lastName,
    email,
    telno,
    phoneno,
  } = req.body.data;
  // if (quantity < 1) return;

  await Database.Execute((database) =>
    database
      .query(
        `UPDATE userdetails SET firstname = \'${firstName}\', middlename = \'${middleName}\', lastname = \'${lastName}\',  email = \'${email}\', telno = \'${telno}\', mobileno = \'${phoneno}\' WHERE userid=${userid}`
      )
      .catch((err) => {
        throw err;
      })
  );

  const result = await Database.Execute((database) =>
    database
      .query(
        `SELECT * FROM users JOIN userdetails ON userdetails.userid = users.id JOIN shippinginformation on shippinginformation.userid = users.id WHERE users.id = ${userid};`
      )
      .then((res) => {
        return JSON.parse(JSON.stringify(res))[0];
      })
      .catch((err) => {
        throw err;
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(result);
});

app.post("/update/shippinginformation", async (req, res) => {
  const { userid, address1, address2, city, province, zipcode } = req.body.data;
  // if (quantity < 1) return;

  await Database.Execute((database) =>
    database
      .query(
        `UPDATE shippinginformation SET address1 = \'${address1}\', address2 = \'${address2}\', city = \'${city}\',  province = \'${province}\', zipcode = \'${zipcode}\' WHERE userid=${userid}`
      )
      .catch((err) => {
        throw err;
      })
  );

  const result = await Database.Execute((database) =>
    database
      .query(
        `SELECT * FROM users JOIN userdetails ON userdetails.userid = users.id JOIN shippinginformation on shippinginformation.userid = users.id WHERE users.id = ${userid};`
      )
      .then((res) => {
        return JSON.parse(JSON.stringify(res))[0];
      })
      .catch((err) => {
        throw err;
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(result);
});

app.put("/update/cart/", async (req, res) => {
  const { user, categoryId, id, quantity } = req.body.data;
  if (quantity < 1) return;

  isExist = await Database.Execute((database) =>
    database
      .query(
        `SELECT DISTINCT(id), quantity FROM wishlist WHERE product = ${id} AND userid = ${user.id} AND userType = \'${user.type}\' AND  category = ${categoryId} AND deleted = 0;`
      )
      .then((result) => {
        return JSON.parse(JSON.stringify(result));
      })
  );

  if (isExist.length > 0)
    Database.Execute((database) =>
      database.query(
        `UPDATE wishlist SET quantity = ${quantity} WHERE id = ${isExist[0].id};`
      )
    );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json({ success: true });
});

app.post("/delete/cart", async (req, res) => {
  const { id, categoryId, user } = req.body;

  await Database.Execute((database) =>
    database.query(
      `UPDATE wishlist SET deleted = 1 WHERE product = ${id} AND category =${categoryId} AND userid =${user.id} AND userType=\'${user.type}\';`
    )
  );

  const count = await Database.Execute((database) =>
    database
      .query(
        `SELECT count(DISTINCT(product)) as wishlistItems FROM wishlist where userid = ${user.id} and userType = '${user.type}' AND deleted = 0 `
      )
      .then((rows) => {
        return rows[0].wishlistItems;
      })
  );

  res.json(count);
});

app.post("/get/cart/itemscount", async (req, res) => {
  const { userId, userType } = req.body;

  const statement = `SELECT count(DISTINCT(product)) as wishlistItems FROM wishlist where userid = ${userId} and userType = '${userType}' AND deleted = 0 `;

  const numOfItems = await Database.Execute((database) =>
    database.query(statement).then((rows) => {
      return rows;
    })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(numOfItems[0].wishlistItems);
});

app.post("/get/cart/items", async (req, res) => {
  const { userId, userType } = req.body;

  const a = `SELECT DISTINCT(category.name) AS name, category.id as id FROM wishlist JOIN category ON category.id = wishlist.category WHERE wishlist.userid = ${userId} AND wishlist.userType = '${userType}'`;
  const categories = await Database.Execute((database) =>
    database
      .query(a)
      .then((row) => {
        return JSON.parse(JSON.stringify(row));
      })
      .catch((err) => console.log(err))
  );

  let b = [];

  categories.forEach((elm) => {
    b.push(
      Database.Execute((database) =>
        database
          .query(`SELECT * FROM filters WHERE filters.category =  ${elm.id}`)
          .then((row) => {
            let data = JSON.parse(JSON.stringify(row));
            return { [elm.name]: data };
          })
          .catch((err) => console.log(err))
      )
    );
  });

  let c = await Promise.all(b).then((data) => {
    return data;
  });

  let columns = [];
  let joins = [];

  c.forEach((elm) => {
    let data;
    Object.keys(elm).forEach((key) => {
      let filters = elm[key];
      let columns = [];
      filters.forEach((obj) =>
        columns.push(`${obj.table}.name AS ${obj.table}`)
      );
      data = { [key]: columns };
    });
    columns.push(data);
  });

  c.forEach((elm) => {
    let data;
    Object.keys(elm).forEach((key) => {
      let filters = elm[key];
      let joins = [];
      filters.forEach((obj) =>
        joins.push(`JOIN ${obj.table} ON ${obj.table}.id = ${key}.${obj.table}`)
      );
      data = { [key]: joins };
    });
    joins.push(data);
  });

  let d = [];
  let e = [];
  categories.forEach((elm) => {
    let columnStrings = [];
    columns.forEach((column) => {
      if (!column[elm.name]) return;
      const str = column[elm.name].join(", ");
      columnStrings.push({ [elm.name]: str });
    });

    joinStrings = [];
    joins.forEach((join) => {
      if (!join[elm.name]) return;
      const str = join[elm.name].join(" ");
      joinStrings.push({ [elm.name]: str });
    });

    e.push(
      `SELECT ${elm.name}.id, ${elm.name}.name, ${
        elm.name
      }.price, image.name AS image, category.id AS categoryId, category.name AS categoryName, ${
        columnStrings[0][elm.name]
      }, quantity from wishlist JOIN ${elm.name} ON ${
        elm.name
      }.id = wishlist.product JOIN image ON image.id = ${
        elm.name
      }.image JOIN category ON category.id = ${elm.name}.category ${
        joinStrings[0][elm.name]
      } WHERE wishlist.userid = ${userId} AND wishlist.userType = '${userType}' AND wishlist.category=${
        elm.id
      } AND wishlist.deleted = 0 GROUP BY wishlist.product;`
    );
  });

  let queries = [];
  for (let i = 0; i < e.length; i++) {
    queries.push(
      Database.Execute((database) =>
        database
          .query(e[i])
          .then((row) => {
            return JSON.parse(JSON.stringify(row));
          })
          .catch((err) => console.log(err))
      )
    );
  }

  const result = await Promise.all(queries).then((data) =>
    data.map((result) => {
      if (!result) return;
      return { ...result };
    })
  );

  let items = [];

  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < Object.keys(result[i]).length; j++) {
      items.push(result[i][`${j}`]);
    }
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(items.length > 0 ? items : false);
});

app.post("/get/order/detail", async (req, res) => {
  const { userid, ordercode } = req.body;

  let detail = await Database.Execute((database) =>
    database
      .query(
        `SELECT * FROM \`order\` WHERE userid = \'${userid}\' AND \`code\` = ${ordercode}`
      )
      .then((row) => {
        return JSON.parse(JSON.stringify(row))[0];
      })
  );

  if (!detail) return;

  let products = await Database.Execute((database) =>
    database
      .query(`SELECT * FROM orderproductlist WHERE  orderid = ${detail.id}`)
      .then((row) => {
        return JSON.parse(JSON.stringify(row));
      })
  );

  let vouchers = await Database.Execute((database) =>
    database
      .query(
        `SELECT voucher.* FROM ordervoucherlist JOIN voucher ON voucher.id = ordervoucherlist.voucherid  WHERE  orderid = ${detail.id}`
      )
      .then((row) => {
        return JSON.parse(JSON.stringify(row));
      })
  );

  let history = await Database.Execute((database) =>
    database
      .query(
        `SELECT orderhistory.id, orderprogress.description, status, \`date\`, \`time\` FROM orderhistory JOIN orderprogress ON orderprogress.id = orderhistory.progress  WHERE  orderid = ${detail.id}`
      )
      .then((row) => {
        return JSON.parse(JSON.stringify(row));
      })
  );

  res.json({ detail, products, vouchers, history });
});

app.get("/check/voucher", async (req, res) => {
  const { voucherCode } = req.query;

  let result = await Database.Execute((database) =>
    database
      .query(`SELECT * FROM voucher where code = \'${voucherCode}\'`)
      .then((row) => {
        return JSON.parse(JSON.stringify(row))[0];
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(result);
});

app.get("/check/username", async (req, res) => {
  const { value } = req.query;

  let result = await Database.Execute((database) =>
    database
      .query(`SELECT * FROM users where username = \'${value}\'`)
      .then((row) => {
        return JSON.parse(JSON.stringify(row));
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(result.length > 0 ? false : true);
});

app.get("/check/username", async (req, res) => {
  const { value } = req.query;

  let result = await Database.Execute((database) =>
    database
      .query(`SELECT * FROM users where username = \'${value}\'`)
      .then((row) => {
        return JSON.parse(JSON.stringify(row));
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.send(result.length > 0 ? false : true);
});

app.get("/check/email", async (req, res) => {
  const { value } = req.query;

  let result = await Database.Execute((database) =>
    database
      .query(`SELECT * FROM userdetails where email = \'${value}\'`)
      .then((row) => {
        return JSON.parse(JSON.stringify(row));
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.send(result.length > 0 ? false : true);
});

app.post("/create/order", async (req, res) => {
  const { order, voucher, installation, userid, usertype, delivery } = req.body;

  let orderid = await Database.Execute((database) =>
    database
      .query(`CALL CreateOrder(?,?,?)`, [userid, usertype, delivery])
      .then((row) => {
        return JSON.parse(JSON.stringify(row))[0][0].id;
      })
  );

  let orderlist = [];
  let voucherlist = [];

  order.forEach((elm) => {
    orderlist.push(
      `(\'${orderid}\', \'${elm.data.name}\', \'${elm.data.quantity}\', \'${elm.data.price}\')`
    );
  });

  if (installation)
    orderlist.push(`(\'${orderid}\',\'Software Installation\',\'3000\',\'1\')`);

  voucher.forEach((elm) => {
    voucherlist.push(`(\'${orderid}\', \'${elm.id}\')`);
  });

  await Database.Execute((database) =>
    database.query(
      `INSERT INTO orderproductlist(orderid, name, quantity, price) VALUES ${orderlist.join(
        ","
      )}`
    )
  );

  if (voucher.length > 0)
    await Database.Execute((database) =>
      database.query(
        `INSERT INTO ordervoucherlist(orderid, voucherid) VALUES ${voucherlist.join(
          ","
        )}`
      )
    );

  await Database.Execute((database) =>
    database.query(
      `INSERT INTO orderhistory(orderid, date, time) VALUES (${orderid}, DATE(NOW()), TIME(NOW()))`
    )
  );

  const ordercode = await Database.Execute((database) =>
    database
      .query(`SELECT code FROM \`order\` WHERE id = ${orderid}`)
      .then((row) => {
        return JSON.parse(JSON.stringify(row))[0].code;
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json({ ordercode });
});

app.post("/create/account", async (req, res) => {
  const {
    username,
    password,
    firstName,
    middleName,
    lastName,
    email,
    telno,
    phoneno,
    address1,
    address2,
    city,
    province,
    zipcode,
  } = req.body.data;

  let result = await Database.Execute((database) =>
    database
      .query(`Call CreateAccount(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        username,
        password,
        firstName,
        middleName,
        lastName,
        email,
        telno,
        phoneno,
        address1,
        address2,
        city,
        province,
        zipcode,
      ])
      .then((row) => {
        return JSON.parse(JSON.stringify(row))[0];
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(result[0]);
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body.data;

  let result = await Database.Execute((database) =>
    database
      .query(
        `SELECT * FROM users JOIN userdetails ON userdetails.userid = users.id JOIN shippinginformation on shippinginformation.userid = users.id WHERE username = \'${username}\' AND password = \'${password}\'`
      )
      .then((row) => {
        return JSON.parse(JSON.stringify(row))[0];
      })
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200);
  res.json(result);
});

io.on("connection", (socket) => {
  console.log("a user is connected " + visitor);

  socket.on("visit", async (data) => {
    visitor += 1;

    Database.Execute((database) =>
      database.query(
        `INSERT INTO visitor (id, os, browser, userid, registered, deleted) VALUES(${visitor},NULL,NULL,NULL,0,0)`
      )
    );

    socket.emit("visitor", visitor);
  });

  socket.on("disconnet", (data) => {
    console.log("a user is disconnected");
  });
});

http.listen(port, function () {
  console.log("listening on *:3001");
});
