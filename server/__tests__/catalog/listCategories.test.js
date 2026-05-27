const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: {},
  ProductVariation: {},
  ProductImage: {},
  Category: { findAll: jest.fn() },
  Brand: {},
  Tag: {},
  Order: {},
  OrderItem: {},
  Question: {},
  Answer: {},
  User: {},
  Role: {},
}))

const { Category } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const CATEGORIES_URL = "/api/products/categories"

const mockCategories = [
  {
    category_id: 1,
    category_name: "Laptop Gaming",
    slug: "laptop-gaming",
    description: "Gaming laptops",
    parent_id: null,
    icon_url: "https://cdn.example/icons/gaming.png",
    display_order: 1,
  },
  {
    category_id: 2,
    category_name: "Ultrabook",
    slug: "ultrabook",
    description: "Thin and light",
    parent_id: 1,
    icon_url: "https://cdn.example/icons/ultra.png",
    display_order: 2,
  },
]

describe("GET /api/products/categories (getCategories)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Category.findAll.mockResolvedValue(mockCategories)
  })

  // FR: AC1 / AC2 / BR-01 — flat list với metadata danh mục
  it("returns 200 with categories including required fields (AC1, AC2, BR-01)", async () => {
    const res = await request(app).get(CATEGORIES_URL)

    expect(res.status).toBe(200)
    expect(res.body.categories).toHaveLength(2)
    expect(res.body.categories[0]).toMatchObject({
      category_id: 1,
      category_name: "Laptop Gaming",
      slug: "laptop-gaming",
      parent_id: null,
      icon_url: "https://cdn.example/icons/gaming.png",
    })
    expect(res.body.categories[1]).toMatchObject({
      category_id: 2,
      category_name: "Ultrabook",
      slug: "ultrabook",
      parent_id: 1,
      icon_url: "https://cdn.example/icons/ultra.png",
    })
  })

  // FR: BR-01 — sort display_order ASC
  it("loads categories ordered by display_order ASC (BR-01)", async () => {
    await request(app).get(CATEGORIES_URL)

    expect(Category.findAll).toHaveBeenCalledWith({
      order: [["display_order", "ASC"]],
    })
  })

  // FR: §10 — danh sách rỗng
  it("returns 200 with empty categories array when none exist (§10)", async () => {
    Category.findAll.mockResolvedValue([])

    const res = await request(app).get(CATEGORIES_URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ categories: [] })
  })

  // FR: AC4 / BR-04 — public endpoint
  it("returns 200 without Authorization header (AC4, BR-04)", async () => {
    const res = await request(app)
      .get(CATEGORIES_URL)
      .unset("Authorization")

    expect(res.status).toBe(200)
    expect(res.body.categories).toHaveLength(2)
    expect(Category.findAll).toHaveBeenCalledTimes(1)
  })

  // Negative — DB error
  it("returns 500 when Category.findAll throws", async () => {
    Category.findAll.mockRejectedValue(new Error("Categories DB error"))

    const res = await request(app).get(CATEGORIES_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Categories DB error")
  })
})
