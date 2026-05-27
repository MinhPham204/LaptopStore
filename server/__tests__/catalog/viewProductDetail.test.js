const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: { findOne: jest.fn(), findAndCountAll: jest.fn() },
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
    product_id: 42,
    product_name: "MacBook Pro M3",
    slug: "macbook-pro-m3",
    description: "High-end laptop",
    is_active: true,
    view_count: 100,
    specs: null,
    category: { category_id: 1, category_name: "Laptop", slug: "laptop" },
    brand: { brand_id: 2, brand_name: "Apple", slug: "apple", logo_url: "/logo.png" },
    variations: [
      {
        variation_id: 10,
        price: "25000000",
        stock_quantity: 5,
        is_available: true,
        is_primary: true,
        processor: "M3",
        ram: "16GB",
        storage: "512GB",
      },
      {
        variation_id: 11,
        price: "23000000",
        stock_quantity: 3,
        is_available: true,
        is_primary: false,
        processor: "M3",
        ram: "8GB",
        storage: "256GB",
      },
    ],
    images: [{ image_url: "https://cdn.example/img.png", display_order: 0 }],
    Tags: [{ tag_id: 1, tag_name: "Premium" }],
    questions: [
      {
        question_id: 1,
        question_text: "Pin dùng được bao lâu?",
        is_answered: true,
        answers: [{ answer_id: 1, answer_text: "Khoảng 18 giờ" }],
        children: [],
      },
    ],
    ...jsonOverrides,
  }

  const instance = {
    increment: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn(() => ({ ...json })),
  }

  return { instance, json }
}

describe("GET /api/products/:id (getProductDetail)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: AC2 — resolve numeric product_id
  it("returns 200 with product when id is numeric", async () => {
    const { instance } = buildMockProduct()
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/42")

    expect(res.status).toBe(200)
    expect(res.body.product).toBeDefined()
    expect(res.body.product.product_id).toBe(42)
    expect(Product.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product_id: "42" },
      })
    )
    expect(instance.increment).toHaveBeenCalledWith("view_count")
  })

  // FR: AC1 — resolve slug
  it('returns 200 and queries by slug when id is not numeric', async () => {
    const { instance } = buildMockProduct({ slug: "my-slug", product_id: 99 })
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/my-slug")

    expect(res.status).toBe(200)
    expect(Product.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "my-slug" },
      })
    )
    expect(res.body.product.slug).toBe("my-slug")
  })

  // FR: AC4 — nested associations in response
  it("returns product with variations, images, questions, Tags, category, and brand", async () => {
    const { instance } = buildMockProduct()
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/42")

    expect(res.status).toBe(200)
    const product = res.body.product
    expect(product.variations).toHaveLength(2)
    expect(product.images).toHaveLength(1)
    expect(product.questions).toHaveLength(1)
    expect(product.Tags).toHaveLength(1)
    expect(product.category.category_name).toBe("Laptop")
    expect(product.brand.brand_name).toBe("Apple")
    expect(Product.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ as: "category" }),
          expect.objectContaining({ as: "brand" }),
          expect.objectContaining({ as: "variations" }),
          expect.objectContaining({ as: "images" }),
          expect.objectContaining({ as: "questions" }),
        ]),
      })
    )
  })

  // FR: AC5 — specs null → {}
  it("normalizes null specs to empty object in response", async () => {
    const { instance } = buildMockProduct({ specs: null })
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/42")

    expect(res.status).toBe(200)
    expect(res.body.product.specs).toEqual({})
  })

  // FR: AC5 / §7 — primaryVariationId from is_primary variation
  it("sets primaryVariationId from primary variation when missing", async () => {
    const { instance } = buildMockProduct()
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/42")

    expect(res.status).toBe(200)
    expect(res.body.product.primaryVariationId).toBe(10)
  })

  // FR: AC6 / BR-02 — view_count increment (see FR_IncrementProductViewCount)
  it("calls product.increment for view_count on successful load", async () => {
    const { instance } = buildMockProduct()
    Product.findOne.mockResolvedValue(instance)

    await request(app).get("/api/products/42")

    expect(instance.increment).toHaveBeenCalledTimes(1)
    expect(instance.increment).toHaveBeenCalledWith("view_count")
  })

  // FR: AC3 — not found
  it("returns 404 when product is not found", async () => {
    Product.findOne.mockResolvedValue(null)

    const res = await request(app).get("/api/products/999")

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Product not found")
  })

  it("returns 500 when findOne throws", async () => {
    Product.findOne.mockRejectedValue(new Error("Detail DB error"))

    const res = await request(app).get("/api/products/42")

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Detail DB error")
  })
})
