import express from "express";

const app = express();
app.use(express.json());

// ---- In-memory data store ----
let users = [];

// CREATE
app.post("/users", (req, res) => {
  const user = { id: users.length + 1, ...req.body };
  users.push(user);
  res.status(201).json(user);
});

// READ (all)
app.get("/users", (_req, res) => {
  res.json(users);
});

// UPDATE
app.put("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  users[idx] = { ...users[idx], ...req.body, id };
  res.json(users[idx]);
});

// DELETE
app.delete("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  users = users.filter(u => u.id !== id);
  res.json({ message: "User deleted" });
});

export default app;
