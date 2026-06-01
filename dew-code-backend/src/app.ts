import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routers/authRouters.js";
import projectRoutes from "./routers/projectRoutes.js";

const app = express();

app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(helmet());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);

export default app;