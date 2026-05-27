const request = require("supertest")
const express = require("express")
const { Op } = require("sequelize")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: { findAndCountAll: jest.fn(), findAll: jest.fn() },
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
const SUGGESTIONS_URL = "/api/products/search-suggestions"

const mockV2Result = (rows = [{ product_id: 1, product_name: "Dell XPS" }], count = rows.length) => {
  Product.findAndCountAll.mockResolvedValue({ count, rows })
}

const getV2Options = () => Product.findAndCountAll.mock.calls.at(-1)[0]
const getSuggestionsOptions = () => Product.findAll.mock.calls.at(-1)[0]

describe("GET /api/products/v2 — search by keyword (getProductsV2)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockV2Result()
    Product.findAll.mockResolvedValue([])
  })

  // FR: AC1 / BR-01 / BR-02 — ILIKE substring trên product_name
  it("filters product_name with iLike when search=dell (AC1, BR-01, BR-02)", async () => {
    const res = await request(app).get(`${V2_URL}?search=dell`)

    expect(res.status).toBe(200)
    expect(getV2Options().where.product_name).toEqual({
      [Op.iLike]: "%dell%",
    })
    expect(getV2Options().where.is_active).toBeUndefined()
  })

  // FR: AC3 / BR-04 — search AND brand_id
  it("combines search with brand_id in where clause (AC3, BR-04)", async () => {
    await request(app).get(`${V2_URL}?search=laptop&brand_id=1`)

    const where = getV2Options().where
    expect(where.brand_id).toBe(1)
    expect(where.product_name).toEqual({ [Op.iLike]: "%laptop%" })
  })

  // FR: §10 — search rỗng hoặc chỉ spaces → không filter tên
  it("does not add product_name filter when search is empty (§10)", async () => {
    await request(app).get(V2_URL)

    expect(getV2Options().where.product_name).toBeUndefined()
  })

  it("does not add product_name filter when search is only whitespace (§10)", async () => {
    await request(app).get(`${V2_URL}?search=${encodeURIComponent("   ")}`)

    expect(getV2Options().where.product_name).toBeUndefined()
  })

  // FR: AC2 — không khớp keyword
  it("returns 200 with empty products when count is zero (AC2)", async () => {
    mockV2Result([], 0)

    const res = await request(app).get(`${V2_URL}?search=nonexistent`)

    expect(res.status).toBe(200)
    expect(res.body.products).toEqual([])
    expect(res.body.total).toBe(0)
    expect(getV2Options().where.product_name).toEqual({
      [Op.iLike]: "%nonexistent%",
    })
  })

  // Negative — DB error
  it("returns 500 when findAndCountAll throws", async () => {
    Product.findAndCountAll.mockRejectedValue(new Error("V2 search DB error"))

    const res = await request(app).get(`${V2_URL}?search=dell`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("V2 search DB error")
  })
})

describe("GET /api/products/search-suggestions — keyword typeahead (getSearchSuggestions)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Product.findAll.mockResolvedValue([])
    mockV2Result()
  })

  // FR: AC4 — q >= 2 gọi findAll với is_active + iLike
  it("queries suggestions with is_active and iLike when q length is at least 2 (AC4)", async () => {
    Product.findAll.mockResolvedValue([
      { product_id: 2, product_name: "Acer Aspire", slug: "acer-aspire" },
    ])

    const res = await request(app).get(`${SUGGESTIONS_URL}?q=ab`)

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(getSuggestionsOptions().where).toEqual({
      is_active: true,
      product_name: { [Op.iLike]: "%ab%" },
    })
    expect(getSuggestionsOptions().limit).toBe(5)
  })

  // FR: AC4 — q < 2 không query DB
  it("returns empty products without calling findAll when q is shorter than 2 (AC4)", async () => {
    const res = await request(app).get(`${SUGGESTIONS_URL}?q=a`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ products: [] })
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // Negative — DB error
  it("returns 500 when findAll throws for suggestions", async () => {
    Product.findAll.mockRejectedValue(new Error("Suggestions keyword DB error"))

    const res = await request(app).get(`${SUGGESTIONS_URL}?q=ab`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Suggestions keyword DB error")
  })
})
