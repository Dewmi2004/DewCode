import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// example controller placeholders
const getProjects = (req: any, res: any) => {
  res.json({ message: "Projects fetched" });
};

const createProject = (req: any, res: any) => {
  res.json({ message: "Project created" });
};

const deleteProject = (req: any, res: any) => {
  res.json({ message: "Project deleted (admin only)" });
};

// 🔒 protected routes
router.get("/", protect, getProjects);
router.post("/", protect, createProject);

// 🔥 role-based route
router.delete("/:id", protect, authorize("admin"), deleteProject);

export default router;