const db = require("../models");
const Auth = db.auth;

module.exports = function (app) {
  app.use(function (_req, res, next) {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
  });
  app.post("/api/auth/post", async (req, res) => {
    try {
      const fileQueue = await Auth.create({
        username: req.body.username,
        password: req.body.password
      });
      res.json({
        message: "User added successfully",
        data: fileQueue,
      });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/get", async (req, res) => {
    try {
      const fileQueue = await Auth.findOne({
        where: {
          username: req.body.username,
          password: req.body.password
        },
      });
      res.json(fileQueue);
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/pusername/:username", async (req, res) => {
    try {
      const fileQueue = await Auth.update(
        {
          username: req.params.username
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

  app.get("/api/auth/putpass/:password", async (req, res) => {
    try {
      const fileQueue = await Auth.update(
        {
          password: req.params.password
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
