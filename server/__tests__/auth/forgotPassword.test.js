const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findOne: jest.fn() },
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

const FORGOT_URL = "/api/auth/forgot-password"
const UNIFORM_MESSAGE = "If the email exists, a reset link has been sent"

const userFixture = (overrides = {}) => ({
  user_id: 42,
  email: "kiet@example.com",
  is_active: true,
  ...overrides,
})

const extractResetTokenFromLogs = (logSpy) => {
  const combined = logSpy.mock.calls.map((args) => args.join(" ")).join("\n")
  const match = combined.match(/reset-password\/verify\?token=([^\s)]+)/)
  if (!match) return null
  return decodeURIComponent(match[1])
}

describe("POST /api/auth/forgot-password", () => {
  let logSpy
  const savedEnv = {}

  beforeEach(() => {
    jest.clearAllMocks()
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {})

    ;["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"].forEach((key) => {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    })

    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    process.env.API_PUBLIC_URL = "http://localhost:5000"
    delete process.env.PASSWORD_RESET_EXPIRES_IN
  })

  afterEach(() => {
    logSpy.mockRestore()
    Object.entries(savedEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    })
  })

  // FR: AC1 / BR-01 — email hợp lệ, user tồn tại → 200 message chung
  it("returns 200 with uniform message when user exists", async () => {
    User.findOne.mockResolvedValue(userFixture())

    const res = await request(app)
      .post(FORGOT_URL)
      .send({ email: "kiet@example.com" })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe(UNIFORM_MESSAGE)
    expect(User.findOne).toHaveBeenCalledWith({ where: { email: "kiet@example.com" } })
  })

  // FR: AC2 / BR-02 — email không tồn tại → 200, không gửi mail
  it("returns 200 without sending email when user does not exist", async () => {
    User.findOne.mockResolvedValue(null)

    const res = await request(app)
      .post(FORGOT_URL)
      .send({ email: "unknown@example.com" })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe(UNIFORM_MESSAGE)

    const mailLogs = logSpy.mock.calls.filter((args) =>
      String(args[0]).includes("[MAIL]")
    )
    expect(mailLogs).toHaveLength(0)
    expect(extractResetTokenFromLogs(logSpy)).toBeNull()
  })

  // FR: AC3 / BR-05 — user tồn tại → log dev chứa link reset-password/verify
  it("logs reset link with verify URL when user exists (dev sendEmail skip)", async () => {
    User.findOne.mockResolvedValue(userFixture())

    await request(app).post(FORGOT_URL).send({ email: "kiet@example.com" })

    const token = extractResetTokenFromLogs(logSpy)
    expect(token).not.toBeNull()
    expect(logSpy.mock.calls.some((args) =>
      String(args.join(" ")).includes("/api/auth/reset-password/verify?token=")
    )).toBe(true)
  })

  // FR: AC5 / BR-03 / BR-04 — token có purpose password_reset, userId, email, TTL ~15m
  it("issues password_reset JWT with userId and email in dev log", async () => {
    User.findOne.mockResolvedValue(userFixture())

    await request(app).post(FORGOT_URL).send({ email: "kiet@example.com" })

    const token = extractResetTokenFromLogs(logSpy)
    const decoded = jwt.decode(token)

    expect(decoded.purpose).toBe("password_reset")
    expect(decoded.userId).toBe(42)
    expect(decoded.email).toBe("kiet@example.com")
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(15 * 60 + 5)
    expect(decoded.exp - decoded.iat).toBeGreaterThanOrEqual(14 * 60)
  })

  // FR: BR-06 — thiếu SMTP không throw, vẫn 200
  it("returns 200 when SMTP is not configured (sendEmail fail-open)", async () => {
    User.findOne.mockResolvedValue(userFixture())

    const res = await request(app)
      .post(FORGOT_URL)
      .send({ email: "kiet@example.com" })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe(UNIFORM_MESSAGE)
    expect(
      logSpy.mock.calls.some((args) => String(args[0]).includes("[MAIL] Missing EMAIL_*"))
    ).toBe(true)
  })

  // FR: AC4 — email sai format → 400
  it("returns 400 when email format is invalid", async () => {
    const res = await request(app)
      .post(FORGOT_URL)
      .send({ email: "not-an-email" })

    expect(res.status).toBe(400)
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: "Invalid email",
          path: "email",
        }),
      ])
    )
    expect(User.findOne).not.toHaveBeenCalled()
  })

  it("returns 400 when email is missing", async () => {
    const res = await request(app).post(FORGOT_URL).send({})

    expect(res.status).toBe(400)
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: "Invalid email",
          path: "email",
        }),
      ])
    )
    expect(User.findOne).not.toHaveBeenCalled()
  })

  // FR: edge case — user inactive vẫn gửi link reset
  it("still logs reset link for inactive user", async () => {
    User.findOne.mockResolvedValue(userFixture({ is_active: false }))

    const res = await request(app)
      .post(FORGOT_URL)
      .send({ email: "kiet@example.com" })

    expect(res.status).toBe(200)
    expect(extractResetTokenFromLogs(logSpy)).not.toBeNull()
  })

  // FR: BR-01 — response giống nhau dù user có hay không
  it("returns the same message body whether or not user exists", async () => {
    User.findOne.mockResolvedValue(userFixture())
    const resFound = await request(app)
      .post(FORGOT_URL)
      .send({ email: "kiet@example.com" })

    jest.clearAllMocks()
    logSpy.mockClear()
    User.findOne.mockResolvedValue(null)
    const resNotFound = await request(app)
      .post(FORGOT_URL)
      .send({ email: "ghost@example.com" })

    expect(resFound.body).toEqual(resNotFound.body)
    expect(resFound.body.message).toBe(UNIFORM_MESSAGE)
  })
})
