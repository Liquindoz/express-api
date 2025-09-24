import request from "supertest";
import app from "../src/app.js";

test("health endpoint works", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("ok");
});
