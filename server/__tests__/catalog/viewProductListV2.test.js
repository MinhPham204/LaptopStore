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

const V2_URL = "/api/products/v2"

const mockListResult = (rows = [{ product_id: 1, product_name: "Laptop A" }], count = rows.length) => {
  Product.findAndCountAll.mockResolvedValue({ count, rows })
}

const getFindOptions = () => Product.findAndCountAll.mock.calls.at(-1)[0]

const getVariationInclude = (options) => options.include.find((inc) => inc.as === "variations")

describe("GET /api/products/v2", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListResult()
  })

  // FR: AC6 / FE default — page=1, limit=30
  it("uses page=1 and limit=30 with correct offset", async () => {
    const res = await request(app).get(`${V2_URL}?page=1&limit=30`)

    expect(res.status).toBe(200)
    const opts = getFindOptions()
    expect(opts.limit).toBe(30)
    expect(opts.offset).toBe(0)
    expect(opts.distinct).toBe(true)
    expect(res.body.pagination).toEqual({
      total: 1,
      page: 1,
      limit: 30,
      totalPages: 1,
    })
  })

  // FR: API default limit=12 when omitted
  it("defaults to page=1 and limit=12 when pagination params are omitted", async () => {
    await request(app).get(V2_URL)

    const opts = getFindOptions()
    expect(opts.limit).toBe(12)
    expect(opts.offset).toBe(0)
  })

  // FR: AC1 sort options
  it.each([
    ["price_asc", [["base_price", "ASC"]]],
    ["price_desc", [["base_price", "DESC"]]],
    ["newest", [["created_at", "DESC"]]],
  ])("orders by %s", async (sortBy, expectedOrder) => {
    await request(app).get(`${V2_URL}?sort_by=${sortBy}`)

    expect(getFindOptions().order).toEqual(expectedOrder)
  })

  // FR: AC3 / BR-03 — best_selling
  it("orders by sold_qty DESC when sort_by=best_selling", async () => {
    await request(app).get(`${V2_URL}?sort_by=best_selling`)

    const opts = getFindOptions()
    expect(opts.attributes).toBeDefined()
    expect(opts.attributes.include).toEqual(
      expect.arrayContaining([expect.arrayContaining([expect.anything(), "sold_qty"])])
    )
    expect(opts.order[0][0].val || String(opts.order[0][0])).toMatch(/sold_qty/i)
    expect(opts.order[0][1]).toBe("DESC")
    expect(opts.order[1]).toEqual(["created_at", "DESC"])
  })

  // FR: BR default sort — sort_by rỗng / invalid
  it("defaults order to created_at DESC when sort_by is empty", async () => {
    await request(app).get(`${V2_URL}?sort_by=`)

    expect(getFindOptions().order).toEqual([["created_at", "DESC"]])
  })

  it("filters by single category_id and brand_id", async () => {
    await request(app).get(`${V2_URL}?category_id=5&brand_id=2`)

    const where = getFindOptions().where
    expect(where.category_id).toBe(5)
    expect(where.brand_id).toBe(2)
    expect(where.is_active).toBeUndefined()
  })

  it("filters by multiple category_id and brand_id from CSV", async () => {
    await request(app).get(`${V2_URL}?category_id=1,3&brand_id=10,20`)

    const where = getFindOptions().where
    expect(where.category_id).toEqual({ [Op.in]: [1, 3] })
    expect(where.brand_id).toEqual({ [Op.in]: [10, 20] })
  })

  it("filters variation specs and aliases cpu, gpu, screenSize, ssd", async () => {
    await request(app).get(
      `${V2_URL}?cpu=i7-13700H,i5-13420H&ram=16GB&ssd=512GB&gpu=RTX%204060&screenSize=15.6`
    )

    const variationInc = getVariationInclude(getFindOptions())
    expect(variationInc.required).toBe(true)
    expect(variationInc.where).toEqual({
      processor: { [Op.in]: ["i7-13700H", "i5-13420H"] },
      ram: { [Op.in]: ["16GB"] },
      storage: { [Op.in]: ["512GB"] },
      graphics_card: { [Op.in]: ["RTX 4060"] },
      screen_size: { [Op.in]: ["15.6"] },
    })
  })

  it("filters processor, ram, storage, graphics_card, screen_size by canonical param names", async () => {
    await request(app).get(
      `${V2_URL}?processor=Ryzen&ram=32GB&storage=1TB&graphics_card=RTX&screen_size=16`
    )

    const variationInc = getVariationInclude(getFindOptions())
    expect(variationInc.required).toBe(true)
    expect(variationInc.where.processor).toEqual({ [Op.in]: ["Ryzen"] })
    expect(variationInc.where.ram).toEqual({ [Op.in]: ["32GB"] })
  })

  // FR: AC5 — spec filter requires variation join
  it("does not set variations required when no spec filters are provided", async () => {
    await request(app).get(V2_URL)

    const variationInc = getVariationInclude(getFindOptions())
    expect(variationInc.required).toBeUndefined()
    expect(variationInc.where).toBeUndefined()
  })

  it("filters base_price with min_price and max_price", async () => {
    await request(app).get(`${V2_URL}?min_price=10000000&max_price=30000000`)

    expect(getFindOptions().where.base_price).toEqual({
      [Op.gte]: 10000000,
      [Op.lte]: 30000000,
    })
  })

  // FR: AC4 — search keyword
  it("filters product_name with iLike when search is provided", async () => {
    await request(app).get(`${V2_URL}?search=macbook`)

    expect(getFindOptions().where.product_name).toEqual({
      [Op.iLike]: "%macbook%",
    })
  })

  // FR: AC4 / AC6 — response shape
  it("returns products, pagination, total, and totalPages", async () => {
    mockListResult(
      [{ product_id: 1 }, { product_id: 2 }],
      45
    )

    const res = await request(app).get(`${V2_URL}?page=2&limit=30`)

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(2)
    expect(res.body.total).toBe(45)
    expect(res.body.totalPages).toBe(2)
    expect(res.body.pagination).toEqual({
      total: 45,
      page: 2,
      limit: 30,
      totalPages: 2,
    })
  })

  // FR: §3 / BR-05 — không filter is_active
  it("does not include is_active in product where clause", async () => {
    await request(app).get(
      `${V2_URL}?search=test&category_id=1&brand_id=2&processor=i7&min_price=1&max_price=99`
    )

    expect(getFindOptions().where.is_active).toBeUndefined()
  })

  // FR: AC2 — empty list
  it("returns 200 with empty products when count is zero", async () => {
    mockListResult([], 0)

    const res = await request(app).get(V2_URL)

    expect(res.status).toBe(200)
    expect(res.body.products).toEqual([])
    expect(res.body.total).toBe(0)
    expect(res.body.totalPages).toBe(0)
    expect(res.body.pagination.total).toBe(0)
  })

  // Negative — DB error
  it("returns 500 when findAndCountAll throws", async () => {
    Product.findAndCountAll.mockRejectedValue(new Error("DB connection failed"))

    const res = await request(app).get(V2_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
