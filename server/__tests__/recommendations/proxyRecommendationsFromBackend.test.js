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

const RECO_URL = "/api/products/variations/42/recommendations"

const metaRow = (productId, overrides = {}) => ({
  toJSON: () => ({
    product_id: productId,
    product_name: overrides.product_name || `Product ${productId}`,
    slug: overrides.slug || `product-${productId}`,
    rating_average: overrides.rating_average ?? 4.5,
    thumbnail_url:
      overrides.thumbnail_url || `https://cdn.example/p${productId}.png`,
    images: overrides.images || [
      {
        image_url: `https://cdn.example/p${productId}-img.png`,
        is_primary: true,
        display_order: 0,
      },
    ],
  }),
})

beforeEach(() => {
  jest.clearAllMocks()
  Product.findAll.mockResolvedValue([])
})

describe("FR_ProxyRecommendationsFromBackend — GET /api/products/variations/:variation_id/recommendations", () => {
  // FR: §5 / AC — items + enrich
  it("returns 200 with mapped products when upstream returns items and DB enrich (§5, AC)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        items: [
          {
            product_id: 2,
            variation_id: 20,
            score: 87.5,
            product_name: "Flask Name",
            price: 22_000_000,
          },
        ],
        generated_at: "2026-05-27T10:00:00.000Z",
      },
    })
    Product.findAll.mockResolvedValue([
      metaRow(2, { product_name: "Laptop XYZ", slug: "laptop-xyz" }),
    ])

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0]).toMatchObject({
      id: 2,
      variation_id: 20,
      name: "Laptop XYZ",
      slug: "laptop-xyz",
      score: 87.5,
      price: 22_000_000,
      image: "https://cdn.example/p2.png",
      rating_average: 4.5,
    })
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/recommend"),
      expect.objectContaining({
        params: { variation_id: 42 },
        timeout: expect.any(Number),
        validateStatus: expect.any(Function),
      })
    )
    expect(Product.findAll).toHaveBeenCalled()
    expect(Product.findAll.mock.calls[0][0].where.product_id[Op.in]).toEqual([2])
  })

  // FR: §6.2 BR-03 — Flask raw JSON array
  it("parses upstream raw JSON array without items wrapper (BR-03)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: [{ product_id: 5, variation_id: 50, score: 0.72, product_name: "Raw" }],
    })
    Product.findAll.mockResolvedValue([metaRow(5, { product_name: "Raw DB" })])

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.products[0]).toMatchObject({
      id: 5,
      variation_id: 50,
      score: 0.72,
      name: "Raw DB",
    })
  })

  // FR: §6.2 BR-04 — debug array
  it("parses recommendations from payload.debug array (BR-04)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        debug: [{ product_id: 3, variation_id: 30, score: 0.8, product_name: "Debug Y" }],
      },
    })
    Product.findAll.mockResolvedValue([metaRow(3, { product_name: "Debug Y DB" })])

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.products[0]).toMatchObject({
      id: 3,
      variation_id: 30,
      score: 0.8,
      name: "Debug Y DB",
    })
  })

  // FR: §6.3 BR-05 — dedupe
  it("deduplicates by product_id keeping the higher score entry (BR-05)", async () => {
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

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0]).toMatchObject({
      id: 2,
      variation_id: 21,
      score: 0.9,
    })
  })

  // FR: §6.3 — performance_score fallback
  it("uses performance_score as score when score is absent (§6.3)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        items: [{ product_id: 7, variation_id: 70, performance_score: 91.2 }],
      },
    })
    Product.findAll.mockResolvedValue([metaRow(7)])

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.products[0].score).toBe(91.2)
  })

  // FR: §5 — response metadata
  it("includes basedOn.variationId, source knn and generated_at (§5)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        items: [{ product_id: 2, variation_id: 20, score: 0.9 }],
        generated_at: "2026-05-27T10:00:00.000Z",
      },
    })
    Product.findAll.mockResolvedValue([metaRow(2)])

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.basedOn).toEqual({ variationId: 42 })
    expect(res.body.source).toBe("knn")
    expect(res.body.generated_at).toBe("2026-05-27T10:00:00.000Z")
  })

  // FR: §6.3 BR-07 — sort descending
  it("sorts products by score descending (BR-07)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        items: [
          { product_id: 1, variation_id: 10, score: 0.3 },
          { product_id: 2, variation_id: 20, score: 0.95 },
          { product_id: 3, variation_id: 30, score: 0.6 },
        ],
      },
    })
    Product.findAll.mockResolvedValue([metaRow(1), metaRow(2), metaRow(3)])

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.products.map((p) => p.score)).toEqual([0.95, 0.6, 0.3])
  })

  // FR: §6.4 — explain block
  it("maps explain fields when upstream provides them (§6.4)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        items: [
          {
            product_id: 2,
            variation_id: 20,
            score: 87.5,
            source: "indexed",
            score_source: "cpu:json-exact,gpu:json-contains",
            cpu_source: "json-exact",
            gpu_source: "json-contains",
          },
        ],
      },
    })
    Product.findAll.mockResolvedValue([metaRow(2)])

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.products[0].explain).toEqual({
      source: "indexed",
      score_source: "cpu:json-exact,gpu:json-contains",
      cpu_source: "json-exact",
      gpu_source: "json-contains",
    })
  })

  // FR: §5 — empty upstream
  it("returns 200 with empty products and skips findAll when upstream is empty (§5)", async () => {
    axios.get.mockResolvedValue({ status: 200, data: { items: [] } })

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(200)
    expect(res.body.products).toEqual([])
    expect(res.body.basedOn).toEqual({ variationId: 42 })
    expect(res.body.source).toBe("knn")
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // FR: §9 BR-13 — public
  it("returns 200 without Authorization header (BR-13)", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: { items: [{ product_id: 2, variation_id: 20, score: 0.5 }] },
    })
    Product.findAll.mockResolvedValue([metaRow(2)])

    const res = await request(app).get(RECO_URL).unset("Authorization")

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
  })

  // FR: §6.1 BR-02 — invalid variation_id
  it.each([
    ["abc", "/api/products/variations/abc/recommendations"],
    ["0", "/api/products/variations/0/recommendations"],
  ])(
    "returns 400 invalid variation_id when param is %s and does not call axios (BR-02)",
    async (_label, url) => {
      const res = await request(app).get(url)

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ products: [], error: "invalid variation_id" })
      expect(axios.get).not.toHaveBeenCalled()
    }
  )

  // FR: §5 — upstream 404
  it("returns 502 upstream_404 with empty products when upstream status is 404 (§5)", async () => {
    axios.get.mockResolvedValue({
      status: 404,
      data: { error: "variation_id not found" },
    })

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(502)
    expect(res.body.products).toEqual([])
    expect(res.body.error).toBe("upstream_404")
    expect(res.body.basedOn).toEqual({ variationId: 42 })
    expect(res.body.source).toBe("knn")
    expect(res.body.upstream).toEqual({ error: "variation_id not found" })
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // FR: §5 — upstream 500
  it("returns 502 upstream_500 when upstream status is 500 (§5)", async () => {
    axios.get.mockResolvedValue({
      status: 500,
      data: { error: "internal server error" },
    })

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(502)
    expect(res.body.products).toEqual([])
    expect(res.body.error).toBe("upstream_500")
    expect(res.body.basedOn).toEqual({ variationId: 42 })
    expect(res.body.source).toBe("knn")
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // FR: §5 — adapter_exception
  it("returns 502 adapter_exception with detail when axios rejects (§5)", async () => {
    const err = new Error("connect ECONNREFUSED")
    err.code = "ECONNREFUSED"
    axios.get.mockRejectedValue(err)

    const res = await request(app).get(RECO_URL)

    expect(res.status).toBe(502)
    expect(res.body.products).toEqual([])
    expect(res.body.error).toBe("adapter_exception")
    expect(res.body.basedOn).toEqual({ variationId: 42 })
    expect(res.body.source).toBe("knn")
    expect(res.body.detail).toMatchObject({
      message: "connect ECONNREFUSED",
      code: "ECONNREFUSED",
      base: expect.stringMatching(/^http/),
    })
  })
})
