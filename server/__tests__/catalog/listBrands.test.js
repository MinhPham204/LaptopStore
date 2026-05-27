const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: {},
  ProductVariation: {},
  ProductImage: {},
  Category: {},
  Brand: { findAll: jest.fn() },
  Tag: {},
  Order: {},
  OrderItem: {},
  Question: {},
  Answer: {},
  User: {},
  Role: {},
}))

const { Brand } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const BRANDS_URL = "/api/products/brands"

const mockBrands = [
  {
    brand_id: 1,
    brand_name: "Apple",
    slug: "apple",
    logo_url: "https://cdn.example/logos/apple.png",
    description: "Apple laptops",
  },
  {
    brand_id: 2,
    brand_name: "Dell",
    slug: "dell",
    logo_url: "https://cdn.example/logos/dell.png",
    description: "Dell laptops",
  },
]

describe("GET /api/products/brands (getBrands)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Brand.findAll.mockResolvedValue(mockBrands)
  })

  // FR: AC1 / AC4 / BR-01 — full public brand list
  it("returns 200 with brands including brand_id, brand_name, and slug (AC1, AC4, BR-01)", async () => {
    const res = await request(app).get(BRANDS_URL)

    expect(res.status).toBe(200)
    expect(res.body.brands).toHaveLength(2)
    expect(res.body.brands[0]).toMatchObject({
      brand_id: 1,
      brand_name: "Apple",
      slug: "apple",
    })
    expect(res.body.brands[1]).toMatchObject({
      brand_id: 2,
      brand_name: "Dell",
      slug: "dell",
    })
  })

  // FR: BR-02 — sort brand_name ASC
  it("loads brands ordered by brand_name ASC (BR-02)", async () => {
    await request(app).get(BRANDS_URL)

    expect(Brand.findAll).toHaveBeenCalledWith({
      order: [["brand_name", "ASC"]],
    })
  })

  // FR: §10 — empty table
  it("returns 200 with empty brands array when none exist (§10)", async () => {
    Brand.findAll.mockResolvedValue([])

    const res = await request(app).get(BRANDS_URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ brands: [] })
  })

  // FR: AC2 / BR-03 — public endpoint, no JWT
  it("returns 200 without Authorization header (AC2, BR-03)", async () => {
    const res = await request(app).get(BRANDS_URL).unset("Authorization")

    expect(res.status).toBe(200)
    expect(res.body.brands).toHaveLength(2)
    expect(Brand.findAll).toHaveBeenCalledTimes(1)
  })

  // FR: §5 — DB error
  it("returns 500 when Brand.findAll throws (§5)", async () => {
    Brand.findAll.mockRejectedValue(new Error("Brands DB error"))

    const res = await request(app).get(BRANDS_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Brands DB error")
  })
})
