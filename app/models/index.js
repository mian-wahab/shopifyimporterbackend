const config = require("../config/db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  config.DB,
  config.USER,
  config.PASSWORD,
  {
    host: config.HOST,
    dialect: config.dialect,
    pool: {
      max: config.pool.max,
      min: config.pool.min,
      acquire: config.pool.acquire,
      idle: config.pool.idle
    }
  }
);

try {
  sequelize.authenticate().then(()=>{
    console.log('Connection has been established successfully.');
  })
} catch (error) {
  console.error('Unable to connect to the database:', error);
}

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.upload = require("../models/upload.model.js")(sequelize, Sequelize);
db.ftp = require("../models/ftp.model.js")(sequelize, Sequelize);
db.auth = require("../models/auth.model.js")(sequelize, Sequelize);

module.exports = db;