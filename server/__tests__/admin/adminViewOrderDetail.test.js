const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn(), name: "User" },
  Role: {},
  Order: { findOne: jest.fn() },
  OrderItem: { name: "OrderItem" },
  ProductVariation: { name: "ProductVariation" },
  Product: { name: "Product" },
  Payment: { name: "Payment" },
}))

const {
  User,
  Order,
  OrderItem,
  ProductVariation,
  Product,
  Payment,
} = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const ORDER_ID = 42
const detailUrl = (id = ORDER_ID) => `/api/admin/orders/${id}`

const ADMIN_USER_ID = 1
const MANAGER_USER_ID = 2
const CUSTOMER_USER_ID = 10
const STAFF_USER_ID = 11

const signSessionToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
  })

const userRecord = (overrides = {}) => ({
  user_id: ADMIN_USER_ID,
  username: "admin",
  full_name: "Quản trị viên",
  email: "admin@example.com",
  is_active: true,
  Roles: [{ role_name: "admin" }],
  ...overrides,
})

const buildAdminOrder = (overrides = {}) => ({
  order_id: ORDER_ID,
  order_code: "ORD-20260527-ABCD",
  user_id: 5,
  total_amount: "25000000.00",
  shipping_fee: "30000.00",
  discount_amount: "500000.00",
  final_amount: "24530000.00",
  status: "processing",
  shipping_address: "123 Nguyen Trai",
  shipping_phone: "0901234567",
  shipping_name: "Nguyen Van A",
  note: "Giao trong gio hanh chinh",
  province_id: 1,
  ward_id: 100,
  reserve_expires_at: null,
  created_at: "2026-05-27T10:00:00.000Z",
  items: [
    {
      order_item_id: 1,
      variation_id: 10,
      quantity: 1,
      price: "25000000.00",
      discount_amount: "500000.00",
      subtotal: "24500000.00",
      variation: {
        variation_id: 10,
        sku: "LAP-X-001",
        product: {
          product_id: 3,
          product_name: "Laptop X",
          thumbnail_url: "https://cdn.example.com/laptop-x.jpg",
        },
      },
    },
  ],
  payment: {
    payment_id: 10,
    payment_method: "COD",
    payment_status: "pending",
    provider: "COD",
    transaction_id: null,
    amount: "24530000.00",
  },
  user: {
    user_id: 5,
    username: "user1",
    email: "a@example.com",
    full_name: "Nguyen A",
    phone_number: "0909876543",
  },
  ...overrides,
})

const setupUserMocks = () => {
  User.findByPk.mockImplementation((id) => {
    if (id === MANAGER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: MANAGER_USER_ID,
          username: "manager1",
          Roles: [{ role_name: "manager" }],
        })
      )
    }
    if (id === CUSTOMER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: CUSTOMER_USER_ID,
          username: "buyer",
          Roles: [{ role_name: "customer" }],
        })
      )
    }
    if (id === STAFF_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: STAFF_USER_ID,
          username: "staff1",
          Roles: [{ role_name: "staff" }],
        })
      )
    }
    return Promise.resolve(userRecord({ user_id: id }))
  })
}

const getOrderDetail = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).get(detailUrl()).set("Authorization", `Bearer ${token}`)

const getFindOptions = () => Order.findOne.mock.calls.at(-1)[0]

describe("GET /api/admin/orders/:order_id (getOrderDetail)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Order.findOne.mockResolvedValue(buildAdminOrder())
  })

  it("returns 200 with body.order for admin", async () => {
    const orderRow = buildAdminOrder()
    Order.findOne.mockResolvedValue(orderRow)

    const res = await getOrderDetail()

    expect(res.status).toBe(200)
    expect(res.body.order).toEqual(orderRow)
    expect(res.body.order.order_id).toBe(ORDER_ID)
  })

  it("returns 200 with body.order for manager", async () => {
    const res = await getOrderDetail(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.order).toBeDefined()
    expect(res.body.order.order_code).toBe("ORD-20260527-ABCD")
  })

  it("queries Order.findOne with items, payment, and user includes per FR §5", async () => {
    await getOrderDetail()

    expect(Order.findOne).toHaveBeenCalledWith({
      where: { order_id: String(ORDER_ID) },
      include: expect.arrayContaining([
        expect.objectContaining({
          model: OrderItem,
          as: "items",
          include: [
            expect.objectContaining({
              model: ProductVariation,
              as: "variation",
              include: [{ model: Product, as: "product" }],
            }),
          ],
        }),
        expect.objectContaining({
          model: Payment,
          as: "payment",
        }),
        expect.objectContaining({
          model: User,
          as: "user",
          attributes: ["user_id", "username", "email", "full_name", "phone_number"],
        }),
      ]),
    })
  })

  it("returns nested items, payment, and user in response (§4)", async () => {
    const res = await getOrderDetail()

    expect(res.body.order.items).toHaveLength(1)
    expect(res.body.order.items[0].variation.product.product_name).toBe("Laptop X")
    expect(res.body.order.items[0].variation.product.thumbnail_url).toContain("laptop-x")
    expect(res.body.order.payment.payment_method).toBe("COD")
    expect(res.body.order.user.email).toBe("a@example.com")
  })

  it("does not filter by user_id — admin views any order (BR-01)", async () => {
    await getOrderDetail()

    const options = getFindOptions()
    expect(options.where).toEqual({ order_id: String(ORDER_ID) })
    expect(options.where.user_id).toBeUndefined()
  })

  it("returns 404 when order is not found", async () => {
    Order.findOne.mockResolvedValue(null)

    const res = await getOrderDetail()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Order not found")
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).get(detailUrl())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await getOrderDetail(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await getOrderDetail(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  it("returns 500 when Order.findOne throws", async () => {
    Order.findOne.mockRejectedValue(new Error("DB read failed"))

    const res = await getOrderDetail()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB read failed")
  })
})
