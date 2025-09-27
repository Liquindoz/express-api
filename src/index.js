import express from "express";
import app from "./app.js;

app.get('/health', (_req, res) => res.status(200).send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`API running on http://localhost:${PORT}`);
});