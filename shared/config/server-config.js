// shared/config/server-config.js
import dotenv from "dotenv";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Required for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Correctly resolve path to root .env
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const configureServer = (app) => {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  console.log("Frontend URL:", process.env.FRONTEND_URL);

  app.use(
    cors({
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    })
  );

  return app;
};

export default configureServer;
