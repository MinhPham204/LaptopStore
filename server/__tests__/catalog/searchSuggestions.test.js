const request = require("supertest")
const express = require("express")
const { Op } = require("sequelize")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: { findAll: jest.fn() },
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

const SUGGESTIONS_URL = "/api/products/search-suggestions"

const getFindAllOptions = () => Product.findAll.mock.calls.at(-1)[0]

const getInclude = (options, as) => options.include.find((inc) => inc.as === as)

describe("GET /api/products/search-suggestions (getSearchSuggestions)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Product.findAll.mockResolvedValue([])
  })

  // FR: AC2 — q >= 2 ký tự, query DB với iLike + is_active
  it("queries active products by product_name when q has at least 2 characters (AC2)", async () => {
    Product.findAll.mockResolvedValue([
      {
        product_id: 1,
        product_name: "Macbook Pro",
        slug: "macbook-pro",
        variations: [{ price: "45000000" }],
        images: [{ image_url: "https://cdn.example/mac.png" }],
      },
    ])

    const res = await request(app).get(`${SUGGESTIONS_URL}?q=ma`)

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0].product_name).toBe("Macbook Pro")

    const opts = getFindAllOptions()
    expect(opts.where).toEqual({
      is_active: true,
      product_name: { [Op.iLike]: "%ma%" },
    })
    expect(opts.limit).toBe(5)
    expect(opts.attributes).toEqual(
      expect.arrayContaining([
        "product_id",
        "product_name",
        "slug",
        "thumbnail_url",
        "base_price",
        "discount_percentage",
      ])
    )

    const variationInc = getInclude(opts, "variations")
    expect(variationInc.attributes).toEqual(["price"])
    expect(variationInc.limit).toBe(1)

    const imageInc = getInclude(opts, "images")
    expect(imageInc.where).toEqual({ is_primary: true })
    expect(imageInc.required).toBe(false)
    expect(imageInc.attributes).toEqual(["image_url"])
  })

  // FR: AC1 — q rỗng không gọi DB
  it("returns empty products without calling findAll when q is omitted (AC1)", async () => {
    const res = await request(app).get(SUGGESTIONS_URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ products: [] })
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // FR: §9 — trim whitespace → length 0
  it("returns empty products when q is only spaces after trim (§9)", async () => {
    const res = await request(app).get(`${SUGGESTIONS_URL}?q=${encodeURIComponent("   ")}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ products: [] })
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // FR: AC2 — tối đa 5 kết quả
  it("returns at most five products from findAll results (AC2)", async () => {
    const rows = [
      { product_id: 1, product_name: "Macbook A", slug: "a" },
      { product_id: 2, product_name: "Macbook B", slug: "b" },
      { product_id: 3, product_name: "Macbook C", slug: "c" },
    ]
    Product.findAll.mockResolvedValue(rows)

    const res = await request(app).get(`${SUGGESTIONS_URL}?q=mac`)

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(3)
    expect(res.body.products.length).toBeLessThanOrEqual(5)
    expect(getFindAllOptions().limit).toBe(5)
  })

  // FR: AC1 — một ký tự
  it("returns empty products when q is a single character (AC1)", async () => {
    const res = await request(app).get(`${SUGGESTIONS_URL}?q=m`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ products: [] })
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // Negative — DB error
  it("returns 500 when findAll throws", async () => {
    Product.findAll.mockRejectedValue(new Error("Suggestions DB error"))

    const res = await request(app).get(`${SUGGESTIONS_URL}?q=lap`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Suggestions DB error")
  })

  // FR: §9 — không có kết quả
  it("returns 200 with empty products when findAll returns no rows", async () => {
    Product.findAll.mockResolvedValue([])

    const res = await request(app).get(`${SUGGESTIONS_URL}?q=laptop`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ products: [] })
    expect(Product.findAll).toHaveBeenCalledTimes(1)
  })
})
