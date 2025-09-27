import express from "express";

const app = express();
app.use(express.json());

// In-memory "database"
let users = [];

// CRUD routes

// Create
app.post('/users', (req, res) => {
  const user = { id: users.length + 1, ...req.body };
  users.push(user);
  res.status(201).json(user);
});

// Read all
app.get('/users', (req, res) => {
  res.json(users);
});

// Update
app.put('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  users[index] = { id, ...req.body };
  res.json(users[index]);
});

// Delete
app.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  users = users.filter(u => u.id !== id);
  res.json({ message: 'User deleted' });
});

export default app;
