const request = require("supertest")
const express = require("express")

jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { user_id: 99, is_active: true, Roles: [] }
    next()
  },
  authorizeRoles: () => (_req, _res, next) => next(),
}))

jest.mock("../../models", () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
  Role: { findOne: jest.fn() },
  Cart: { findOne: jest.fn(), create: jest.fn() },
  CartItem: { findAll: jest.fn() },
  ProductVariation: {},
  Product: {},
  ProductImage: {},
}))

const { User, Role, Cart, CartItem } = require("../../models")
const authRoutes = require("../../routes/authRoutes")
const cartRoutes = require("../../routes/cartRoutes")
const errorHandler = require("../../middleware/errorHandler")

const authApp = express()
authApp.use(express.json())
authApp.use("/api/auth", authRoutes)
authApp.use(errorHandler)

const cartApp = express()
cartApp.use(express.json())
cartApp.use("/api/cart", cartRoutes)
cartApp.use(errorHandler)

const REGISTER_URL = "/api/auth/register"
const REGISTER_EMAIL_URL = "/api/auth/register-email"
const CART_URL = "/api/cart"

const validPayload = () => ({
  username: "kietpham",
  email: "kiet@example.com",
  password: "secret123",
  full_name: "Kiệt Phạm",
  phone_number: "0901234567",
})

const createdUserFixture = (overrides = {}) => ({
  user_id: 42,
  username: "kietpham",
  email: "kiet@example.com",
  full_name: "Kiệt Phạm",
  phone_number: "0901234567",
  addRole: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

const customerRoleFixture = () => ({ role_id: 1, role_name: "customer" })

const setupRegisterSuccess = () => {
  User.findOne.mockResolvedValue(null)
  Role.findOne.mockResolvedValue(customerRoleFixture())
  User.create.mockResolvedValue(createdUserFixture())
  Cart.create.mockResolvedValue({ cart_id: 1, user_id: 42 })
}

describe("FR AutoCreateCartOnRegistration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    CartItem.findAll.mockResolvedValue([])
  })

  describe("POST /api/auth/register", () => {
    // FR: AC1 — user mới register → Cart.create({ user_id })
    it("calls Cart.create with new user_id after successful direct register", async () => {
      setupRegisterSuccess()

      const res = await request(authApp).post(REGISTER_URL).send(validPayload())

      expect(res.status).toBe(201)
      expect(User.create).toHaveBeenCalled()
      expect(Cart.create).toHaveBeenCalledTimes(1)
      expect(Cart.create).toHaveBeenCalledWith({ user_id: 42 })
    })

    // FR: AC1 — thứ tự: User.create trước Cart.create
    it("creates cart only after User.create on direct register", async () => {
      setupRegisterSuccess()

      await request(authApp).post(REGISTER_URL).send(validPayload())

      const userCreateOrder = User.create.mock.invocationCallOrder[0]
      const cartCreateOrder = Cart.create.mock.invocationCallOrder[0]
      expect(userCreateOrder).toBeLessThan(cartCreateOrder)
    })

    // FR: negative — trùng user → 409, không tạo cart
    it("does not call Cart.create when direct register finds duplicate user", async () => {
      User.findOne.mockResolvedValue({
        username: "kietpham",
        email: "other@example.com",
        phone_number: "0999999999",
      })

      const res = await request(authApp).post(REGISTER_URL).send(validPayload())

      expect(res.status).toBe(409)
      expect(res.body.message).toBe("Duplicate entry")
      expect(User.create).not.toHaveBeenCalled()
      expect(Cart.create).not.toHaveBeenCalled()
    })

    // FR: AC6 — Cart.create reject (UNIQUE user_id) → error handler 409
    it("returns 409 when Cart.create fails with unique constraint on register", async () => {
      setupRegisterSuccess()
      const uniqueError = Object.assign(new Error("user_id must be unique"), {
        name: "SequelizeUniqueConstraintError",
        errors: [{ path: "user_id", message: "user_id must be unique" }],
      })
      Cart.create.mockRejectedValue(uniqueError)

      const res = await request(authApp).post(REGISTER_URL).send(validPayload())

      expect(res.status).toBe(409)
      expect(res.body.message).toBe("Duplicate entry")
      expect(User.create).toHaveBeenCalled()
      expect(Cart.create).toHaveBeenCalledWith({ user_id: 42 })
    })
  })

  describe("POST /api/auth/register-email", () => {
    // FR: AC2 — register-email thành công → cart trước verify; user is_active false
    it("calls Cart.create after User.create with is_active false on register-email", async () => {
      setupRegisterSuccess()

      const res = await request(authApp)
        .post(REGISTER_EMAIL_URL)
        .send(validPayload())

      expect(res.status).toBe(201)
      expect(res.body.message).toBe("Verification email sent")
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          username: "kietpham",
        })
      )
      expect(Cart.create).toHaveBeenCalledTimes(1)
      expect(Cart.create).toHaveBeenCalledWith({ user_id: 42 })

      const userCreateOrder = User.create.mock.invocationCallOrder[0]
      const cartCreateOrder = Cart.create.mock.invocationCallOrder[0]
      expect(userCreateOrder).toBeLessThan(cartCreateOrder)
    })

    // FR: negative — register-email trùng user → 409, không Cart.create
    it("does not call Cart.create when register-email finds duplicate user", async () => {
      User.findOne.mockResolvedValue({
        username: "kietpham",
        email: "kiet@example.com",
        phone_number: "0901234567",
      })

      const res = await request(authApp)
        .post(REGISTER_EMAIL_URL)
        .send(validPayload())

      expect(res.status).toBe(409)
      expect(User.create).not.toHaveBeenCalled()
      expect(Cart.create).not.toHaveBeenCalled()
    })
  })

  describe("GET /api/cart — getOrCreateCart fallback", () => {
    // FR: AC5 — không có cart → Cart.create, response 200
    it("creates cart via getOrCreateCart when Cart.findOne returns null", async () => {
      Cart.findOne.mockResolvedValue(null)
      Cart.create.mockResolvedValue({ cart_id: 7, user_id: 99 })

      const res = await request(cartApp).get(CART_URL)

      expect(res.status).toBe(200)
      expect(Cart.findOne).toHaveBeenCalledWith({ where: { user_id: 99 } })
      expect(Cart.create).toHaveBeenCalledTimes(1)
      expect(Cart.create).toHaveBeenCalledWith({ user_id: 99 })
      expect(res.body.cart).toEqual(
        expect.objectContaining({
          cart_id: 7,
          item_count: 0,
          items: [],
        })
      )
    })

    // FR: AC5 — đã có cart → không gọi Cart.create
    it("does not call Cart.create when cart already exists for user", async () => {
      Cart.findOne.mockResolvedValue({ cart_id: 3, user_id: 99 })

      const res = await request(cartApp).get(CART_URL)

      expect(res.status).toBe(200)
      expect(res.body.cart.cart_id).toBe(3)
      expect(Cart.create).not.toHaveBeenCalled()
    })
  })

  /*
   * FR: AC3 / AC4 — OAuth findOrCreateOAuthUser (passport.js, không export).
   * Không unit test trong repo (không sửa production để export).
   * Báo cáo CSV: N/A unit.
   */
})
