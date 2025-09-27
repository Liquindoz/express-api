import app from "./app.js";

// Health check
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

const PORT = process.env.PORT || 3031;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
