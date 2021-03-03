#!/usr/bin/env node

const express = require("express");
const fs = require("fs");
const cors = require("cors");
const prettyBytes = require("pretty-bytes");
const mime = require("mime-types");
const moment = require("moment");
const formidable = require("formidable");
const _path = require("path");
const prompt = require("prompt");
const axios = require("axios");
const publicIp = require("public-ip");

let config;
fs.stat("./config.json", (error) => {
  console.log("===========================================");
  console.log("Welcome to Paradigm Personal Drawer Server!");
  console.log("===========================================");
  if (error) {
    config = {};

    prompt.message = "";

    const schema = {
      properties: {
        username: {
          required: true,
          hidden: true,
        },
        password: {
          required: true,
          hidden: true,
        },
        "server name": {
          required: true,
          hidden: true,
        },
      },
    };

    prompt.start();

    prompt.get(schema, function (err, result) {
      console.log("Signing in...");
      axios
        .post("https://www.theparadigmdev.com/api/authentication/signin", {
          username: result.username,
          password: result.password,
          sticky: true,
        })
        .then(async (response) => {
          console.log("Authenticated successfully!");
          console.log("Generating configuration...");
          config.user_id = response.data.user._id;

          var timestamp = ((new Date().getTime() / 1000) | 0).toString(16);
          config.instance_id =
            timestamp +
            "xxxxxxxxxxxxxxxx"
              .replace(/[x]/g, function () {
                return ((Math.random() * 16) | 0).toString(16);
              })
              .toLowerCase();

          fs.writeFileSync(
            "./config.json",
            JSON.stringify({
              jwt: response.data.jwt,
              instance_id: config.instance_id,
              name: result["server name"],
            })
          );

          console.log("Configuration generated!");
          console.log("Instantiating server...");

          axios
            .post(
              `https://www.theparadigmdev.com/api/drawer/${config.user_id}/pds`,
              {
                ip: await publicIp.v4(),
                instance_id: config.instance_id,
                name: result["server name"],
              }
            )
            .then((response) => {
              console.log(response);
              console.log("Server instantiated successfully!");
            })
            .catch((error) => {
              console.log("Server instantiated unsuccessfully!");
              console.error(error);
            });
        });
    });
  } else {
    console.log("Reading configuration...");
    config = JSON.parse(fs.readFileSync("./config.json"));
    console.log("Configuration read successfully!");
    console.log("Reinstantiating server...");
    axios
      .post("https://www.theparadigmdev.com/api/authentication/verify", {
        jwt: config.jwt,
      })
      .then((response) => {
        console.log("Server reinstantiated successfully!");
        console.log("Listening on port 54387...");
      });
  }
});

const app = express();
const dir = "/";

app.use(express.json());
app.use(cors());

function files(path) {
  const dir = fs.readdirSync(path, { withFileTypes: true });

  let stats = [];
  dir.forEach(async (item) => {
    if (item.name[0] != ".") {
      let stat = fs.statSync(`${decodeURIComponent(path)}/${item.name}`);

      stats.push({
        name: item.name,
        size: prettyBytes(stat.size),
        modified: moment(stat.mtime).format("M/D/YYYY [at] h:mm"),
        dir: stat.isDirectory(),
        type:
          mime.lookup(`${decodeURIComponent(path)}/${item.name}`) ||
          _path.extname(item.name) + " file",
        path:
          decodeURIComponent(path) != "/"
            ? `/${item.name}`
            : `${decodeURIComponent(path)}/${item.name}`,
      });
    }
  });

  return stats;
}

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.get("/api/:path", (req, res) => {
  if (decodeURIComponent(req.params.path) == "/") {
    res.json({ files: files("/") });
  } else {
    res.json({
      files: files(
        dir +
          "/" +
          decodeURIComponent(req.params.path).substring(dir.length + 1)
      ),
    });
  }
});

app.get("/api/download/:path", async (req, res) => {
  res.download(decodeURIComponent(req.params.path));
});

app.post("/api/:path", async (req, res) => {
  const file_path = decodeURIComponent(req.params.path);

  const form = formidable({
    multiples: true,
    uploadDir: file_path,
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024 * 1024,
  });

  form.on("file", (filename, file) => {
    fs.renameSync(file.path, `${file_path}/${file.name}`);
  });

  form.once("end", () => {
    res.json({ files: files(file_path) });
  });

  await form.parse(req, async (error, fields, items) => {
    if (error) {
      console.error(error);
      res.end();
    } else {
      Object.keys(items).forEach(async (i) => {});
    }
  });
});

app.delete("/api/:path", async (req, res) => {
  const path = decodeURIComponent(req.params.path);

  if (fs.statSync(path).isDirectory()) {
    fs.rmdir(
      path,
      { maxRetries: 3, retryDelay: 100, recursive: true },
      function (err) {
        if (err) console.error(err);
        res.json({ files: files(path.substring(0, path.lastIndexOf("/"))) });
      }
    );
  } else {
    fs.unlink(path, async (error) => {
      if (error) throw error;
      res.json({ files: files(path.substring(0, path.lastIndexOf("/"))) });
    });
  }
});

app.post("/api/rename/:path", async (req, res) => {
  fs.rename(decodeURIComponent(req.params.path), req.body.new, async (err) => {
    if (err) throw err;
    res.json({
      files: files(req.body.new.substring(0, req.body.new.lastIndexOf("/"))),
    });
  });
});

app.put("/api/:path", (req, res) => {
  const path = decodeURIComponent(req.params.path);

  if (fs.existsSync(path + "/New folder")) {
    res.json({ error: "New folder already exists!" });
  } else {
    fs.mkdirSync(path + "/New folder");
    res.json({ files: files(path) });
  }
});

app.listen(54387);
