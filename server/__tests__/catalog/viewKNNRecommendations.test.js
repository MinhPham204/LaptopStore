const request = require("supertest")
const express = require("express")

jest.mock("axios")

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

const axios = require("axios")
const { Op } = require("sequelize")
const { Product } = require("../../models")
const { getRecommendedByVariation } = require("../../controllers/productController")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.get(
  "/api/products/variations/:variation_id/recommendations",
  getRecommendedByVariation
)
app.use(errorHandler)

const metaRow = (productId, overrides = {}) => ({
  toJSON: () => ({
    product_id: productId,
    product_name: overrides.product_name || `Product ${productId}`,
    slug: overrides.slug || `product-${productId}`,
    rating_average: overrides.rating_average ?? 4.5,
    thumbnail_url: overrides.thumbnail_url || `https://cdn.example/p${productId}.png`,
    images: overrides.images || [
      { image_url: `https://cdn.example/p${productId}-img.png`, is_primary: true, display_order: 0 },
    ],
  }),
})

beforeEach(() => {
  jest.clearAllMocks()
  Product.findAll.mockResolvedValue([])
})

describe("GET /api/products/variations/:variation_id/recommendations (getRecommendedByVariation)", () => {
  // FR: AC1 — proxy upstream items và enrich qua fetchProductMeta
  it("returns 200 with mapped products when upstream returns items (AC1)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        items: [{ product_id: 2, variation_id: 20, score: 0.9, product_name: "X" }],
        generated_at: "2025-05-27T10:00:00.000Z",
      },
    })
    Product.findAll.mockResolvedValue([
      metaRow(2, { product_name: "Laptop X", slug: "laptop-x" }),
    ])

    const res = await request(app).get("/api/products/variations/10/recommendations")

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0]).toMatchObject({
      id: 2,
      variation_id: 20,
      name: "Laptop X",
      score: 0.9,
      slug: "laptop-x",
    })
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/recommend"),
      expect.objectContaining({ params: { variation_id: 10 } })
    )
    expect(Product.findAll).toHaveBeenCalled()
    const findAllArg = Product.findAll.mock.calls[0][0]
    expect(findAllArg.where.product_id[Op.in]).toEqual([2])
  })

  // FR: AC1 — parse payload.debug khi không có items
  it("parses recommendations from debug array shape (AC1)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        debug: [{ product_id: 3, variation_id: 30, score: 0.8, product_name: "Debug Y" }],
      },
    })
    Product.findAll.mockResolvedValue([metaRow(3, { product_name: "Debug Y DB" })])

    const res = await request(app).get("/api/products/variations/10/recommendations")

    expect(res.status).toBe(200)
    expect(res.body.products[0]).toMatchObject({
      id: 3,
      variation_id: 30,
      score: 0.8,
      name: "Debug Y DB",
    })
  })

  // FR: BR-01 / §7 — dedupe theo product_id giữ score cao hơn
  it("deduplicates by product_id keeping the higher score entry", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        items: [
          { product_id: 2, variation_id: 20, score: 0.5 },
          { product_id: 2, variation_id: 21, score: 0.9 },
        ],
      },
    })
    Product.findAll.mockResolvedValue([metaRow(2)])

    const res = await request(app).get("/api/products/variations/10/recommendations")

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0]).toMatchObject({
      id: 2,
      variation_id: 21,
      score: 0.9,
    })
  })

  // FR: AC1 — metadata response contract
  it("includes basedOn.variationId and source knn on success (AC1)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: { items: [{ product_id: 2, variation_id: 20, score: 0.9 }] },
    })
    Product.findAll.mockResolvedValue([metaRow(2)])

    const res = await request(app).get("/api/products/variations/10/recommendations")

    expect(res.status).toBe(200)
    expect(res.body.basedOn).toEqual({ variationId: 10 })
    expect(res.body.source).toBe("knn")
    expect(res.body.generated_at).toBeDefined()
  })

  // FR: AC1 edge — variation_id không phải số hợp lệ
  it("returns 400 when variation_id is not a valid number (AC1 edge)", async () => {
    const res = await request(app).get("/api/products/variations/abc/recommendations")

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ products: [], error: "invalid variation_id" })
    expect(axios.get).not.toHaveBeenCalled()
  })

  // FR: AC3 / BR-02 — upstream 404 → 502 graceful degrade
  it("returns 502 upstream_404 with empty products when axios status is 404 (AC3, BR-02)", async () => {
    axios.get.mockResolvedValue({
      status: 404,
      data: { message: "variation not in index" },
    })

    const res = await request(app).get("/api/products/variations/10/recommendations")

    expect(res.status).toBe(502)
    expect(res.body.products).toEqual([])
    expect(res.body.error).toBe("upstream_404")
    expect(res.body.basedOn).toEqual({ variationId: 10 })
    expect(res.body.source).toBe("knn")
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // FR: AC3 — axios throw → adapter_exception
  it("returns 502 adapter_exception when axios rejects (AC3)", async () => {
    axios.get.mockRejectedValue(new Error("ECONNREFUSED"))

    const res = await request(app).get("/api/products/variations/10/recommendations")

    expect(res.status).toBe(502)
    expect(res.body.products).toEqual([])
    expect(res.body.error).toBe("adapter_exception")
    expect(res.body.basedOn).toEqual({ variationId: 10 })
    expect(res.body.source).toBe("knn")
  })

  // FR: AC1 — upstream rỗng vẫn 200
  it("returns 200 with empty products when upstream items is empty", async () => {
    axios.get.mockResolvedValue({ status: 200, data: { items: [] } })

    const res = await request(app).get("/api/products/variations/10/recommendations")

    expect(res.status).toBe(200)
    expect(res.body.products).toEqual([])
    expect(res.body.basedOn).toEqual({ variationId: 10 })
    expect(res.body.source).toBe("knn")
    expect(Product.findAll).not.toHaveBeenCalled()
  })
})
