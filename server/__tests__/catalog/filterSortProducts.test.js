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

const mockListResult = (rows = [{ product_id: 1 }], count = rows.length) => {
  Product.findAndCountAll.mockResolvedValue({ count, rows })
}

const getFindOptions = () => Product.findAndCountAll.mock.calls.at(-1)[0]
const getVariationInclude = (options) => options.include.find((inc) => inc.as === "variations")

describe("GET /api/products/v2 — filter & sort (getProductsV2)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListResult()
  })

  // FR: AC1 / BR-01 — single brand filter
  it("filters by single brand_id (AC1, BR-01)", async () => {
    await request(app).get(`${V2_URL}?brand_id=1`)

    expect(getFindOptions().where.brand_id).toBe(1)
  })

  // FR: AC1 / BR-01 — multiple brands OR (IN)
  it("filters by multiple brand_id values with Op.in (AC1, BR-01)", async () => {
    await request(app).get(`${V2_URL}?brand_id=1,2`)

    expect(getFindOptions().where.brand_id).toEqual({ [Op.in]: [1, 2] })
  })

  // FR: AC2 / BR-02 — spec filter on variations
  it("requires variations join when processor filter is set (AC2, BR-02)", async () => {
    await request(app).get(`${V2_URL}?processor=Intel`)

    const variationInc = getVariationInclude(getFindOptions())
    expect(variationInc.required).toBe(true)
    expect(variationInc.where.processor).toEqual({ [Op.in]: ["Intel"] })
  })

  // FR: AC3 — sort by price ascending
  it("orders by base_price ASC when sort_by=price_asc (AC3)", async () => {
    await request(app).get(`${V2_URL}?sort_by=price_asc`)

    expect(getFindOptions().order).toEqual([["base_price", "ASC"]])
  })

  // FR: AC3 — other sort presets
  it.each([
    ["price_desc", [["base_price", "DESC"]]],
    ["newest", [["created_at", "DESC"]]],
  ])("orders correctly when sort_by=%s (AC3)", async (sortBy, expectedOrder) => {
    await request(app).get(`${V2_URL}?sort_by=${sortBy}`)

    expect(getFindOptions().order).toEqual(expectedOrder)
  })

  // FR: AC3 — best_selling sort
  it("orders by sold_qty DESC when sort_by=best_selling (AC3)", async () => {
    await request(app).get(`${V2_URL}?sort_by=best_selling`)

    const opts = getFindOptions()
    expect(opts.attributes.include).toEqual(
      expect.arrayContaining([expect.arrayContaining([expect.anything(), "sold_qty"])])
    )
    expect(opts.order[0][0].val || String(opts.order[0][0])).toMatch(/sold_qty/i)
    expect(opts.order[0][1]).toBe("DESC")
    expect(opts.order[1]).toEqual(["created_at", "DESC"])
  })

  // FR: BR-06 — empty sortBy → Phổ biến / created_at DESC
  it("defaults order to created_at DESC when sort_by is empty (BR-06)", async () => {
    await request(app).get(`${V2_URL}?sort_by=`)

    expect(getFindOptions().order).toEqual([["created_at", "DESC"]])
  })

  // FR: AC1 — price range on base_price
  it("filters base_price with min_price and max_price", async () => {
    await request(app).get(`${V2_URL}?min_price=10000000&max_price=30000000`)

    expect(getFindOptions().where.base_price).toEqual({
      [Op.gte]: 10000000,
      [Op.lte]: 30000000,
    })
  })

  // FR: BR-03 — search combined with other filters
  it("filters product_name with iLike when search is provided", async () => {
    await request(app).get(`${V2_URL}?search=laptop`)

    expect(getFindOptions().where.product_name).toEqual({
      [Op.iLike]: "%laptop%",
    })
  })

  // FR: AC6 — pagination limit and offset
  it("applies page and limit to findAndCountAll (AC6)", async () => {
    mockListResult([{ product_id: 1 }, { product_id: 2 }], 45)

    const res = await request(app).get(`${V2_URL}?page=2&limit=30`)

    expect(res.status).toBe(200)
    const opts = getFindOptions()
    expect(opts.limit).toBe(30)
    expect(opts.offset).toBe(30)
    expect(opts.distinct).toBe(true)
    expect(res.body.pagination).toEqual({
      total: 45,
      page: 2,
      limit: 30,
      totalPages: 2,
    })
  })

  // FR: BR-03 — cross-dimension AND (category + brand)
  it("combines category_id and brand_id in where clause (BR-03)", async () => {
    await request(app).get(`${V2_URL}?category_id=5&brand_id=2`)

    const where = getFindOptions().where
    expect(where.category_id).toBe(5)
    expect(where.brand_id).toBe(2)
  })

  // FR: BR-02 — multi spec OR within field
  it("filters multiple processor values with Op.in (BR-02)", async () => {
    await request(app).get(`${V2_URL}?processor=Intel,AMD`)

    const variationInc = getVariationInclude(getFindOptions())
    expect(variationInc.where.processor).toEqual({ [Op.in]: ["Intel", "AMD"] })
  })

  // FR: §12 — tight filter returns empty list
  it("returns 200 with empty products when no rows match filters (§12)", async () => {
    mockListResult([], 0)

    const res = await request(app).get(
      `${V2_URL}?brand_id=99&processor=NonExistentCPU&search=zzz`
    )

    expect(res.status).toBe(200)
    expect(res.body.products).toEqual([])
    expect(res.body.total).toBe(0)
    expect(res.body.pagination.total).toBe(0)
  })

  // Negative — DB error
  it("returns 500 when findAndCountAll throws", async () => {
    Product.findAndCountAll.mockRejectedValue(new Error("Filter sort DB error"))

    const res = await request(app).get(V2_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Filter sort DB error")
  })
})
