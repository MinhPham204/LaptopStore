const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: { findOne: jest.fn() },
  ProductVariation: {},
  ProductImage: {},
  Category: {},
  Brand: {},
  Tag: {},
  Order: {},
  OrderItem: {},
  Question: {},
  Answer: {},
  User: {},
  Role: {},
}))

const { Product } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const buildMockProduct = (jsonOverrides = {}) => {
  const json = {
    product_id: 1,
    product_name: "Test Laptop",
    slug: "test-slug",
    is_active: true,
    view_count: 100,
    specs: {},
    variations: [{ variation_id: 10, price: "20000000", is_primary: true }],
    images: [],
    Tags: [],
    questions: [],
    ...jsonOverrides,
  }

  const instance = {
    increment: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn(() => ({ ...json })),
  }

  return { instance, json }
}

describe("GET /api/products/:id — increment view_count (getProductDetail)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: AC1 / BR-01 — mỗi GET detail thành công +1 view
  it('calls product.increment("view_count") once when product is found (AC1, BR-01)', async () => {
    const { instance } = buildMockProduct({ product_id: 1, view_count: 100 })
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/1")

    expect(res.status).toBe(200)
    expect(res.body.product.product_id).toBe(1)
    expect(instance.increment).toHaveBeenCalledTimes(1)
    expect(instance.increment).toHaveBeenCalledWith("view_count")
  })

  // FR: AC1 / BR-01 — slug route cũng increment
  it('calls increment when detail is loaded by slug (AC1, BR-01)', async () => {
    const { instance } = buildMockProduct({ slug: "test-slug", product_id: 5 })
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/test-slug")

    expect(res.status).toBe(200)
    expect(res.body.product.slug).toBe("test-slug")
    expect(instance.increment).toHaveBeenCalledWith("view_count")
  })

  // FR: BR-05 — guest không cần auth vẫn tăng view
  it("increments view_count for unauthenticated requests (BR-05)", async () => {
    const { instance } = buildMockProduct()
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/1").unset("Authorization")

    expect(res.status).toBe(200)
    expect(instance.increment).toHaveBeenCalledWith("view_count")
  })

  // FR: AC3 / BR-03 — không await increment; response 200 ngay
  it("returns 200 before increment promise resolves (AC3, BR-03)", async () => {
    let resolveIncrement
    const incrementPromise = new Promise((resolve) => {
      resolveIncrement = resolve
    })

    const { instance } = buildMockProduct()
    instance.increment.mockReturnValue(incrementPromise)
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/1")

    expect(res.status).toBe(200)
    expect(instance.increment).toHaveBeenCalledWith("view_count")
    expect(resolveIncrement).toBeDefined()

    resolveIncrement()
    await incrementPromise
  })

  // FR: AC4 / BR-04 — lỗi increment không đổi HTTP 200
  it("returns 200 when increment rejects (AC4, BR-04)", async () => {
    const { instance } = buildMockProduct()
    instance.increment.mockRejectedValue(new Error("Increment failed"))
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/1")

    expect(res.status).toBe(200)
    expect(res.body.product).toBeDefined()
    expect(instance.increment).toHaveBeenCalledWith("view_count")
  })

  // FR: AC2 / BR-02 — 404 không gọi increment
  it("returns 404 and does not call increment when product is not found (AC2, BR-02)", async () => {
    Product.findOne.mockResolvedValue(null)

    const res = await request(app).get("/api/products/999")

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
    expect(res.body.product).toBeUndefined()
  })
})
