const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: {},
  ProductVariation: { findAll: jest.fn() },
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

const { sequelize, ProductVariation } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const FACETS_URL = "/api/products/facets"

const FACET_FIELD_ORDER = [
  "processor",
  "ram",
  "storage",
  "graphics_card",
  "screen_size",
]

const setupVariationMocks = (overrides = {}) => {
  const defaults = {
    processor: [{ value: "Intel Core i7" }, { value: "AMD Ryzen 7" }],
    ram: [{ value: "16GB" }, { value: "8GB" }],
    storage: [{ value: "512GB SSD" }],
    graphics_card: [{ value: "NVIDIA RTX 4060" }],
    screen_size: [{ value: '15.6"' }],
  }
  const data = { ...defaults, ...overrides }

  ProductVariation.findAll.mockImplementation(async (options) => {
    const field = FACET_FIELD_ORDER.find((name) =>
      JSON.stringify(options.attributes).includes(`"${name}"`)
    )
    return data[field] ?? []
  })
}

describe("GET /api/products/facets (getProductFacets)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupVariationMocks()
    sequelize.query.mockResolvedValue([[{ value: "1.8kg" }, { value: "1.5kg" }]])
  })

  // FR: AC1 — đủ 6 nhóm facet
  it("returns 200 with all six facet keys (AC1)", async () => {
    const res = await request(app).get(FACETS_URL)

    expect(res.status).toBe(200)
    expect(res.body.facets).toEqual({
      processor: ["AMD Ryzen 7", "Intel Core i7"],
      ram: ["16GB", "8GB"],
      storage: ["512GB SSD"],
      graphics_card: ["NVIDIA RTX 4060"],
      screen_size: ['15.6"'],
      weight: ["1.5kg", "1.8kg"],
    })
    expect(ProductVariation.findAll).toHaveBeenCalledTimes(5)
    expect(sequelize.query).toHaveBeenCalledTimes(1)
  })

  // FR: AC2 — sort localeCompare
  it("sorts variation facet values with localeCompare (AC2)", async () => {
    setupVariationMocks({
      processor: [
        { value: "Zen 3" },
        { value: "Intel Core i7" },
        { value: "AMD Ryzen 7" },
        { value: "Apple M3" },
      ],
    })

    const res = await request(app).get(FACETS_URL)

    expect(res.body.facets.processor).toEqual([
      "AMD Ryzen 7",
      "Apple M3",
      "Intel Core i7",
      "Zen 3",
    ])
  })

  // FR: AC2 / BR-01 — lọc null và chuỗi rỗng
  it("filters out null and empty variation values (AC2, BR-01)", async () => {
    setupVariationMocks({
      ram: [{ value: "32GB" }, { value: null }, { value: "" }, { value: "16GB" }],
    })

    const res = await request(app).get(FACETS_URL)

    expect(res.body.facets.ram).toEqual(["16GB", "32GB"])
  })

  // FR: AC3 — weight từ specs JSONB query
  it("maps weight facet values from sequelize query rows (AC3)", async () => {
    sequelize.query.mockResolvedValue([
      [{ value: "2.1kg" }, { value: "1.8kg" }, { value: "1.5kg" }],
    ])

    const res = await request(app).get(FACETS_URL)

    expect(res.body.facets.weight).toEqual(["1.5kg", "1.8kg", "2.1kg"])
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("specs->>'weight'")
    )
  })

  // FR: AC5 — lỗi weight không fail endpoint
  it("returns 200 with empty weight when sequelize.query throws (AC5)", async () => {
    sequelize.query.mockRejectedValue(new Error("JSONB query failed"))

    const res = await request(app).get(FACETS_URL)

    expect(res.status).toBe(200)
    expect(res.body.facets.weight).toEqual([])
    expect(res.body.facets.processor).toEqual(["AMD Ryzen 7", "Intel Core i7"])
  })

  // Negative — variation query failure
  it("returns 500 when ProductVariation.findAll throws", async () => {
    ProductVariation.findAll.mockReset()
    ProductVariation.findAll.mockRejectedValue(new Error("Facets variation DB error"))

    const res = await request(app).get(FACETS_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Facets variation DB error")
  })
})
