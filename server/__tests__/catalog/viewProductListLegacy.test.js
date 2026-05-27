const request = require("supertest")
const express = require("express")
const { Op } = require("sequelize")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: { findAndCountAll: jest.fn() },
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

const LEGACY_URL = "/api/products"

const mockListResult = (rows = [{ product_id: 1, product_name: "Laptop A" }], count = rows.length) => {
  Product.findAndCountAll.mockResolvedValue({ count, rows })
}

const getFindOptions = () => Product.findAndCountAll.mock.calls.at(-1)[0]

describe("GET /api/products (legacy getProducts)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListResult()
  })

  // FR: AC1 — default pagination
  it("uses page=1 and limit=12 with offset 0 by default", async () => {
    const res = await request(app).get(LEGACY_URL)

    expect(res.status).toBe(200)
    const opts = getFindOptions()
    expect(opts.limit).toBe(12)
    expect(opts.offset).toBe(0)
    expect(opts.distinct).toBe(true)
    expect(res.body.pagination).toEqual({
      total: 1,
      page: 1,
      limit: 12,
      totalPages: 1,
    })
  })

  // FR: AC2 — whitelist sort + order
  it("orders by view_count DESC when sort and order are provided", async () => {
    await request(app).get(`${LEGACY_URL}?sort=view_count&order=DESC`)

    expect(getFindOptions().order).toEqual([["view_count", "DESC"]])
  })

  // FR: AC2 — invalid sort falls back to created_at
  it("falls back to created_at DESC when sort is not in whitelist", async () => {
    await request(app).get(`${LEGACY_URL}?sort=not_a_column`)

    expect(getFindOptions().order).toEqual([["created_at", "DESC"]])
  })

  it("filters by single category_id", async () => {
    await request(app).get(`${LEGACY_URL}?category_id=1`)

    const where = getFindOptions().where
    expect(where.is_active).toBe(true)
    expect(where.category_id).toBe(1)
  })

  it("filters by multiple category_id values from CSV", async () => {
    await request(app).get(`${LEGACY_URL}?category_id=1,2`)

    expect(getFindOptions().where.category_id).toEqual({ [Op.in]: [1, 2] })
  })

  it("filters by brand_id single and multiple", async () => {
    await request(app).get(`${LEGACY_URL}?brand_id=5`)
    expect(getFindOptions().where.brand_id).toBe(5)

    await request(app).get(`${LEGACY_URL}?brand_id=10,20`)
    expect(getFindOptions().where.brand_id).toEqual({ [Op.in]: [10, 20] })
  })

  // FR: AC3 — search
  it("filters product_name with iLike when search is provided", async () => {
    await request(app).get(`${LEGACY_URL}?search=dell`)

    expect(getFindOptions().where.product_name).toEqual({
      [Op.iLike]: "%dell%",
    })
  })

  it("filters base_price with min_price and max_price", async () => {
    await request(app).get(`${LEGACY_URL}?min_price=5000000&max_price=25000000`)

    expect(getFindOptions().where.base_price).toEqual({
      [Op.gte]: 5000000,
      [Op.lte]: 25000000,
    })
  })

  // FR: legacy — chỉ sản phẩm active
  it("always includes is_active true in where clause", async () => {
    await request(app).get(
      `${LEGACY_URL}?search=test&category_id=1&brand_id=2&min_price=1`
    )

    expect(getFindOptions().where.is_active).toBe(true)
  })

  // FR: AC4 — response shape
  it("returns products, pagination.total, and totalPages", async () => {
    mockListResult([{ product_id: 1 }, { product_id: 2 }], 25)

    const res = await request(app).get(`${LEGACY_URL}?page=2&limit=10`)

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(2)
    expect(res.body.total).toBe(25)
    expect(res.body.totalPages).toBe(3)
    expect(res.body.pagination).toEqual({
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    })
    expect(getFindOptions().offset).toBe(10)
  })

  it("returns 500 when findAndCountAll throws", async () => {
    Product.findAndCountAll.mockRejectedValue(new Error("Legacy list DB error"))

    const res = await request(app).get(LEGACY_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Legacy list DB error")
  })
})
