const { Op } = require("sequelize");
const db = require("../models");
const upload = require("../utils/upload"); // Configure uploads
const UploadTask = db.upload;

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
  });

  app.post("/api/upload/post", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileQueue = await UploadTask.create({
        filename: req.file.filename,
        status: "queue",
      });
      res.json({
        message: "File uploaded successfully",
        data: fileQueue,
      });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/upload/get", async (req, res) => {
    try {
      const fileQueue = await UploadTask.findAll({
        where: {
          status: "queue"
        },
      });
      res.json(fileQueue);
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/upload/getall", async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1; // Get page number from query params, default to 1 if not provided
      const limit = 3;
      const offset = (page - 1) * limit;
      const { count, rows: data } = await UploadTask.findAndCountAll({
        offset,
        order: [
          ['createdAt', 'DESC']
      ],
        limit
      });
      const totalPages = Math.ceil(count / limit);

      res.json({
        data,
        currentPage: page,
        totalPages,
        totalCount: count
      });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/upload/put/:id", async (req, res) => {
    try {
      const fileQueue = await UploadTask.update(
        {
          status: "processed"
        },
        {
          where: {
            id: req.params.id,
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

  app.get("/api/upload/putprogres/:id", async (req, res) => {
    try {
      const fileQueue = await UploadTask.update(
        {
          status: "progress"
        },
        {
          where: {
            id: req.params.id,
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

  app.get("/api/upload/putfailed/:id", async (req, res) => {
    try {
      const fileQueue = await UploadTask.update(
        {
          status: "failed"
        },
        {
          where: {
            id: req.params.id,
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

  app.get("/api/upload/cancel/:filename", async (req, res) => {
    try {
      const result = await UploadTask.update(
        {
          status: "failed"
        },
        {
          where: {
            filename: req.params.filename,
            status: "progress"
          },
        }
      );
      if (result[0] === 1) {
        res.send({ message: "File status updated to failed" });
      } else {
        res.send({ message: "Error while updating data" });
      }
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

};
