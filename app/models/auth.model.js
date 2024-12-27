module.exports = (sequelize, Sequelize) => {
    const Auth = sequelize.define("Auth", {
      username: {
        type: Sequelize.STRING,
      },
      password: {
        type: Sequelize.STRING,
      }
    });
  
    return Auth;
  };
  