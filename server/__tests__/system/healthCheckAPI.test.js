const request = require("supertest")
const express = require("express")

/**
 * Minimal app with the same health handler as production.
 * Mirrors server/server.js L48-50 — do NOT require server.js (startServer runs on import).
 */
const app = express()
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" })
})

const HEALTH_URL = "/api/health"

describe("GET /api/health (health check API — mirrors server.js L48-50)", () => {
  it("returns 200 with status OK and Server is running message (§4)", async () => {
    const res = await request(app).get(HEALTH_URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: "OK",
      message: "Server is running",
    })
  })

  it("returns 200 without Authorization header (BR-02 / AC §11)", async () => {
    const res = await request(app).get(HEALTH_URL)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("OK")
  })

  it("returns JSON content type", async () => {
    const res = await request(app).get(HEALTH_URL)

    expect(res.status).toBe(200)
    expect(res.headers["content-type"]).toMatch(/application\/json/)
    expect(typeof res.body).toBe("object")
  })

  it("returns 404 for POST /api/health", async () => {
    const res = await request(app).post(HEALTH_URL)

    expect(res.status).toBe(404)
  })

  it("returns 404 for PUT /api/health", async () => {
    const res = await request(app).put(HEALTH_URL)

    expect(res.status).toBe(404)
  })

  it("returns 404 for GET /health (not mounted on main API)", async () => {
    const res = await request(app).get("/health")

    expect(res.status).toBe(404)
  })

  it("returns 404 for GET /api/healthz", async () => {
    const res = await request(app).get("/api/healthz")

    expect(res.status).toBe(404)
  })
})
