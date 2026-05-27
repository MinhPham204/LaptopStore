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

const PROFILE_URL = "/api/auth/profile"

const signSessionToken = (userId, overrides = {}) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
    ...overrides,
  })

const createMockUser = (overrides = {}) => {
  const user = {
    user_id: 42,
    username: "kiet_shop",
    email: "kiet@example.com",
    full_name: "Nguyen Kiet",
    phone_number: "0901234567",
    address: "123 Đường ABC",
    avatar_url: "https://cdn.example/old.png",
    is_active: true,
    Roles: [{ role_name: "customer" }],
    ...overrides,
  }
  user.update = jest.fn().mockImplementation(async (data) => {
    Object.assign(user, data)
    return user
  })
  return user
}

const fullUpdateBody = () => ({
  full_name: "Nguyen Van A",
  phone_number: "0909123456",
  address: "Số nhà 1, phường 2",
  avatar_url: "https://cdn.example/new-avatar.jpg",
})

describe("PUT /api/auth/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
  })

  // FR: AC1 / BR-04 — cập nhật thành công, response không có roles
  it("returns 200 with updated user fields and no roles in response", async () => {
    const user = createMockUser()
    User.findByPk.mockResolvedValue(user)
    const token = signSessionToken(42)
    const body = fullUpdateBody()

    const res = await request(app)
      .put(PROFILE_URL)
      .set("Authorization", `Bearer ${token}`)
      .send(body)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Profile updated successfully")
    expect(res.body.user).toEqual({
      user_id: 42,
      username: "kiet_shop",
      email: "kiet@example.com",
      full_name: body.full_name,
      phone_number: body.phone_number,
      address: body.address,
      avatar_url: body.avatar_url,
    })
    expect(res.body.user.roles).toBeUndefined()
    expect(user.update).toHaveBeenCalledWith({
      full_name: body.full_name,
      phone_number: body.phone_number,
      address: body.address,
      avatar_url: body.avatar_url,
    })
  })

  // FR: BR-01 — update nhận đúng 4 key từ body
  it("calls req.user.update with the four profile keys from request body", async () => {
    const user = createMockUser()
    User.findByPk.mockResolvedValue(user)
    const body = fullUpdateBody()

    await request(app)
      .put(PROFILE_URL)
      .set("Authorization", `Bearer ${signSessionToken(42)}`)
      .send(body)

    expect(user.update).toHaveBeenCalledTimes(1)
    expect(user.update).toHaveBeenCalledWith({
      full_name: "Nguyen Van A",
      phone_number: "0909123456",
      address: "Số nhà 1, phường 2",
      avatar_url: "https://cdn.example/new-avatar.jpg",
    })
  })

  // FR: BR-02 — partial update (chỉ full_name)
  it("returns 200 when only full_name is sent in body", async () => {
    const user = createMockUser()
    User.findByPk.mockResolvedValue(user)

    const res = await request(app)
      .put(PROFILE_URL)
      .set("Authorization", `Bearer ${signSessionToken(42)}`)
      .send({ full_name: "Only Name Changed" })

    expect(res.status).toBe(200)
    expect(res.body.user.full_name).toBe("Only Name Changed")
    expect(user.update).toHaveBeenCalledWith({
      full_name: "Only Name Changed",
      phone_number: undefined,
      address: undefined,
      avatar_url: undefined,
    })
  })

  // FR: edge — body rỗng vẫn 200
  it("returns 200 when request body is empty", async () => {
    const user = createMockUser()
    User.findByPk.mockResolvedValue(user)

    const res = await request(app)
      .put(PROFILE_URL)
      .set("Authorization", `Bearer ${signSessionToken(42)}`)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Profile updated successfully")
    expect(user.update).toHaveBeenCalled()
  })

  // FR: AC2 — thiếu Authorization
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).put(PROFILE_URL).send(fullUpdateBody())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC2 — token không hợp lệ
  it("returns 401 when token is invalid", async () => {
    const res = await request(app)
      .put(PROFILE_URL)
      .set("Authorization", "Bearer invalid-jwt")
      .send(fullUpdateBody())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Invalid or expired token")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC2 — token hết hạn
  it("returns 401 when token is expired", async () => {
    const expired = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: "-1s" })

    const res = await request(app)
      .put(PROFILE_URL)
      .set("Authorization", `Bearer ${expired}`)
      .send(fullUpdateBody())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Invalid or expired token")
  })

  // FR: AC3 — user inactive
  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(createMockUser({ is_active: false }))

    const res = await request(app)
      .put(PROFILE_URL)
      .set("Authorization", `Bearer ${signSessionToken(42)}`)
      .send(fullUpdateBody())

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
  })

  // FR: edge — user.update reject → 500
  it("returns 500 when user.update fails", async () => {
    const user = createMockUser()
    user.update.mockRejectedValue(new Error("DB write failed"))
    User.findByPk.mockResolvedValue(user)

    const res = await request(app)
      .put(PROFILE_URL)
      .set("Authorization", `Bearer ${signSessionToken(42)}`)
      .send(fullUpdateBody())

    expect(res.status).toBe(500)
  })
})
