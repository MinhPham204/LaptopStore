const request = require("supertest")
const express = require("express")

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

const FEATURED_URL = "/api/products/v2?page=1&limit=12&sort_by=best_selling"

const mockListResult = (rows = [{ product_id: 1, product_name: "Best Seller" }], count = rows.length) => {
  Product.findAndCountAll.mockResolvedValue({ count, rows })
}

const getFindOptions = () => Product.findAndCountAll.mock.calls.at(-1)[0]

describe("GET /api/products/v2 (featured carousel — best_selling)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListResult()
  })

  // FR: AC1 / AC2 / BR-01 / BR-02 — HomePage featuredFilters → API contract
  it("returns 200 with products for featured query page=1 limit=12 sort_by=best_selling (AC1, AC2)", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      product_id: i + 1,
      product_name: `Featured ${i + 1}`,
    }))
    mockListResult(rows, 12)

    const res = await request(app).get(FEATURED_URL)

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(12)
    expect(res.body.pagination).toEqual({
      total: 12,
      page: 1,
      limit: 12,
      totalPages: 1,
    })

    const opts = getFindOptions()
    expect(opts.limit).toBe(12)
    expect(opts.offset).toBe(0)
    expect(opts.distinct).toBe(true)
  })

  // FR: BR-01 — featured = best_selling sort (sold_qty DESC)
  it("orders by sold_qty DESC when sort_by=best_selling (BR-01)", async () => {
    await request(app).get(FEATURED_URL)

    const opts = getFindOptions()
    expect(opts.attributes).toBeDefined()
    expect(opts.attributes.include).toEqual(
      expect.arrayContaining([expect.arrayContaining([expect.anything(), "sold_qty"])])
    )
    expect(opts.order[0][0].val || String(opts.order[0][0])).toMatch(/sold_qty/i)
    expect(opts.order[0][1]).toBe("DESC")
    expect(opts.order[1]).toEqual(["created_at", "DESC"])
  })

  // FR: BR-02 — max 12 items per request
  it("caps fetch at limit 12 for featured carousel (BR-02)", async () => {
    await request(app).get(FEATURED_URL)

    expect(getFindOptions().limit).toBe(12)
    expect(getFindOptions().offset).toBe(0)
  })

  // FR: AC1 — empty featured block data source
  it("returns 200 with empty products when no best sellers exist", async () => {
    mockListResult([], 0)

    const res = await request(app).get(FEATURED_URL)

    expect(res.status).toBe(200)
    expect(res.body.products).toEqual([])
    expect(res.body.total).toBe(0)
  })

  // FR: BR-04 — v2 does not filter is_active for featured list
  it("does not include is_active in where clause for featured v2 query", async () => {
    await request(app).get(FEATURED_URL)

    expect(getFindOptions().where.is_active).toBeUndefined()
  })

  // Negative — DB failure
  it("returns 500 when findAndCountAll throws", async () => {
    Product.findAndCountAll.mockRejectedValue(new Error("Featured list DB error"))

    const res = await request(app).get(FEATURED_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Featured list DB error")
  })
})
