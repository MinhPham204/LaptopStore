const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn() },
  Role: {},
  Cart: {},
}))

const { User } = require("../../models")
const authRoutes = require("../../routes/authRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/auth", authRoutes)
app.use(errorHandler)

const VERIFY_URL = "/api/auth/reset-password/verify"
const FE_BASE = "http://localhost:3000"

const signPasswordResetToken = (overrides = {}) =>
  jwt.sign(
    {
      purpose: "password_reset",
      userId: 42,
      email: "a@b.com",
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  )

const extractTokenFromLocation = (location) => {
  const url = new URL(location)
  return decodeURIComponent(url.searchParams.get("token") || "")
}

describe("GET /api/auth/reset-password/verify", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    process.env.FRONTEND_URL = FE_BASE
    delete process.env.CLIENT_URL
  })

  // FR: AC1 / BR-02 — token password_reset hợp lệ → redirect FE với token pass-through
  it("redirects to login reset mode with token when password_reset JWT is valid", async () => {
    const resetToken = signPasswordResetToken()

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: resetToken })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(
      `${FE_BASE}/login?mode=reset&token=${encodeURIComponent(resetToken)}`
    )

    const forwarded = extractTokenFromLocation(res.headers.location)
    const decoded = jwt.verify(forwarded, process.env.JWT_SECRET)
    expect(decoded.purpose).toBe("password_reset")
    expect(decoded.userId).toBe(42)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC3 — thiếu token
  it("redirects to login with error=missing when token is absent", async () => {
    const res = await request(app).get(VERIFY_URL).redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?mode=reset&error=missing`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC2 — JWT hết hạn
  it("redirects to login with error=invalid when token is expired", async () => {
    const expiredToken = jwt.sign(
      { purpose: "password_reset", userId: 42, email: "a@b.com" },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    )

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: expiredToken })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?mode=reset&error=invalid`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC2 — JWT malformed
  it("redirects to login with error=invalid when token is malformed", async () => {
    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: "not-a-jwt" })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?mode=reset&error=invalid`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC7 — purpose email_verify → invalid
  it("redirects to login with error=invalid when purpose is email_verify", async () => {
    const emailVerifyToken = jwt.sign(
      { purpose: "email_verify", userId: 42, email: "a@b.com" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    )

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: emailVerifyToken })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?mode=reset&error=invalid`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC7 — session JWT (no purpose) → invalid
  it("redirects to login with error=invalid when token is a session JWT without purpose", async () => {
    const sessionToken = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: "7d" })

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: sessionToken })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?mode=reset&error=invalid`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC4 / BR-01 — verify redirect không đọc DB
  it("never calls User.findByPk on any verify redirect outcome", async () => {
    const cases = [
      () => request(app).get(VERIFY_URL).redirects(0),
      () =>
        request(app)
          .get(VERIFY_URL)
          .query({ token: signPasswordResetToken() })
          .redirects(0),
      () =>
        request(app)
          .get(VERIFY_URL)
          .query({ token: "bad" })
          .redirects(0),
    ]

    for (const run of cases) {
      jest.clearAllMocks()
      await run()
      expect(User.findByPk).not.toHaveBeenCalled()
    }
  })
})
