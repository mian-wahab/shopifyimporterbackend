const db = require("../models");
const FTP = db.ftp;

module.exports = function (app) {
  app.use(function (_req, res, next) {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
  });
  app.post("/api/ftp/post", async (req, res) => {
    try {
      const fileQueue = await FTP.create({
        host: req.body.host,
        username: req.body.username,
        password: req.body.password,
        port: req.body.port
      });
      res.json({
        message: "FTP INFO added successfully",
        data: fileQueue,
      });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/ftp/get", async (_req, res) => {
    try {
      const fileQueue = await FTP.findOne({
        where: {
            id: 1
        },
      });
      res.json(fileQueue);
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/ftp/put", async (req, res) => {
    try {
      const fileQueue = await FTP.update(
        {
            host: req.body.host,
            username: req.body.username,
            password: req.body.password,
            port: req.body.port        
        },
        {
          where: {
            id: 1
          },
        }
      );
      if (fileQueue[0]==1) {
        res.send({ message: "sucess" });
      } else {
        res.send({ message: "Error while updating data" });
      }
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });
};
