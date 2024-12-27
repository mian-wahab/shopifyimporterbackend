module.exports = (sequelize, Sequelize) => {
const FileQueue = sequelize.define('FileQueue', {
  filename: {
    type: Sequelize.STRING
  },
  status: {
    type: Sequelize.STRING
  }
});

return FileQueue

}