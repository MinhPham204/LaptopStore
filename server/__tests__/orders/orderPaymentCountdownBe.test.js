const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../config/database", () => ({
  transaction: jest.fn(),
}))

jest.mock("../../services/shippingService", () => ({
  quoteShipping: jest.fn(),
}))

jest.mock("../../services/vnpayService", () => ({
  getPaymentUrl: jest.fn(),
}))

jest.mock("../../config/socket", () => ({
  getIO: jest.fn(),
}))

jest.mock("../../services/notificationService", () => ({}))

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Order: { findAndCountAll: jest.fn(), findOne: jest.fn() },
  OrderItem: {},
  Payment: {},
  ProductVariation: {},
  Cart: {},
  CartItem: {},
  Product: {},
}))

const { User, Order } = require("../../models")
const orderRoutes = require("../../routes/orderRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/orders", orderRoutes)
app.use(errorHandler)

const USER_ID = 42
const ORDER_ID = 100

const signSessionToken = (userId = USER_ID) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
  })

const activeUserRecord = () => ({
  user_id: USER_ID,
  username: "buyer",
  email: "buyer@example.com",
  is_active: true,
  Roles: [{ role_name: "customer" }],
})

const reserveExpiresAt = new Date("2026-05-29T12:00:00.000Z")

const buildListRow = () => ({
  toJSON: () => ({
    order_id: ORDER_ID,
    order_code: "ORD-CDT-100",
    status: "AWAITING_PAYMENT",
    final_amount: 1_500_000,
    shipping_fee: 30_000,
    created_at: "2026-05-28T12:00:00.000Z",
    reserve_expires_at: reserveExpiresAt,
    payment: {
      provider: "VNPAY",
      payment_method: "VNPAYQR",
      payment_status: "pending",
      txn_ref: "TXN-1",
    },
    items: [
      {
        variation_id: 10,
        quantity: 1,
        variation: {
          product: {
            product_name: "Laptop Pro",
            images: [],
            thumbnail_url: null,
          },
        },
      },
    ],
  }),
})

const buildSlimRow = () => ({
  toJSON: () => ({
    order_id: ORDER_ID,
    order_code: "ORD-CDT-100",
    status: "AWAITING_PAYMENT",
    total_amount: 1_500_000,
    discount_amount: 0,
    final_amount: 1_500_000,
    shipping_fee: 30_000,
    shipping_name: "Nguyen Van A",
    shipping_phone: "0901234567",
    shipping_address: "123 Street",
    province_id: 1,
    ward_id: 2,
    geo_lat: null,
    geo_lng: null,
    created_at: "2026-05-28T12:00:00.000Z",
    reserve_expires_at: reserveExpiresAt,
    payment: {
      provider: "VNPAY",
      payment_method: "VNPAYQR",
      payment_status: "pending",
      amount: 1_500_000,
      txn_ref: "TXN-1",
      paid_at: null,
    },
    items: [
      {
        order_item_id: 1,
        variation_id: 10,
        quantity: 1,
        price: 1_500_000,
        discount_amount: 0,
        subtotal: 1_500_000,
        variation: {
          product: {
            product_id: 1,
            product_name: "Laptop Pro",
            images: [],
            thumbnail_url: null,
            slug: "laptop-pro",
          },
        },
      },
    ],
  }),
})

describe("FR_OrderPaymentCountdownTimer — backend data sources", () => {
  beforeEach(() => {
    User.findByPk.mockResolvedValue(activeUserRecord())
  })

  // FR: §4 list API — reserve_expires_at mapped
  it("getUserOrdersV2 returns reserve_expires_at on each order (§4)", async () => {
    Order.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [buildListRow()],
    })

    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.orders).toHaveLength(1)
    expect(res.body.orders[0].reserve_expires_at).toBe(
      reserveExpiresAt.toISOString()
    )
  })

  // FR: GAP-01 — slim omits reserve_expires_at
  it("getOrderDetailSlim does not expose reserve_expires_at on order (GAP-01)", async () => {
    Order.findOne.mockResolvedValue(buildSlimRow())

    const res = await request(app)
      .get(`/api/orders/${ORDER_ID}/slim`)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.order.order_id).toBe(ORDER_ID)
    expect(res.body.order.reserve_expires_at).toBeUndefined()
  })
})
