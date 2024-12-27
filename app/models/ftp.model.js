module.exports = (sequelize, Sequelize) => {
  const FTP = sequelize.define("FTP", {
    host: {
      type: Sequelize.STRING,
    },
    username: {
      type: Sequelize.STRING,
    },
    password: {
      type: Sequelize.STRING,
    },
    port: {
      type: Sequelize.STRING,
    },
  });

  return FTP;
};
