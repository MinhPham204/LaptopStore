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

const RESET_URL = "/api/auth/reset-password"

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

const createMockUser = (overrides = {}) => {
  const user = {
    user_id: 42,
    email: "a@b.com",
    is_active: true,
    password_hash: null,
    ...overrides,
  }
  user.update = jest.fn().mockImplementation(async (data) => {
    Object.assign(user, data)
    return user
  })
  return user
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
  })

  // FR: AC1 / AC6 / BR-02 / BR-03 — đổi mật khẩu thành công, không trả session token
  it("returns 200 and updates password_hash when token and password are valid", async () => {
    const user = createMockUser()
    User.findByPk.mockResolvedValue(user)
    const token = signPasswordResetToken()

    const res = await request(app)
      .post(RESET_URL)
      .send({ token, password: "newSecret456" })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: "Password updated successfully" })
    expect(res.body.token).toBeUndefined()
    expect(User.findByPk).toHaveBeenCalledWith(42)
    expect(user.update).toHaveBeenCalledWith({ password_hash: "newSecret456" })
  })

  // FR: BR-01 — chỉ chấp nhận purpose password_reset
  it('returns 400 Invalid token when purpose is email_verify', async () => {
    const emailVerifyToken = jwt.sign(
      { purpose: "email_verify", userId: 42, email: "a@b.com" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    )

    const res = await request(app)
      .post(RESET_URL)
      .send({ token: emailVerifyToken, password: "newSecret456" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid token")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  describe("validation — 400", () => {
    // FR: AC4 — thiếu token
    it("returns 400 with errors when token is missing", async () => {
      const res = await request(app)
        .post(RESET_URL)
        .send({ password: "newSecret456" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Token is required",
            path: "token",
          }),
        ])
      )
      expect(User.findByPk).not.toHaveBeenCalled()
    })

    // FR: AC4 — password quá ngắn
    it("returns 400 with errors when password is too short", async () => {
      const res = await request(app)
        .post(RESET_URL)
        .send({ token: signPasswordResetToken(), password: "12345" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Password must be at least 6 characters",
            path: "password",
          }),
        ])
      )
      expect(User.findByPk).not.toHaveBeenCalled()
    })
  })

  // FR: AC2 — JWT hết hạn
  it("returns 400 Invalid or expired token when JWT is expired", async () => {
    const expiredToken = jwt.sign(
      { purpose: "password_reset", userId: 42, email: "a@b.com" },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    )

    const res = await request(app)
      .post(RESET_URL)
      .send({ token: expiredToken, password: "newSecret456" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid or expired token")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC2 — JWT sai secret
  it("returns 400 Invalid or expired token when JWT secret does not match", async () => {
    const wrongSecretToken = jwt.sign(
      { purpose: "password_reset", userId: 42, email: "a@b.com" },
      "another-secret",
      { expiresIn: "15m" }
    )

    const res = await request(app)
      .post(RESET_URL)
      .send({ token: wrongSecretToken, password: "newSecret456" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid or expired token")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC3 — user không tồn tại
  it("returns 404 when user is not found", async () => {
    User.findByPk.mockResolvedValue(null)

    const res = await request(app)
      .post(RESET_URL)
      .send({ token: signPasswordResetToken(), password: "newSecret456" })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("User not found")
  })
})
