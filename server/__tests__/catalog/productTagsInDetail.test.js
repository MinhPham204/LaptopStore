const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: { findOne: jest.fn() },
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

const { Product, Tag } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const buildMockProduct = (jsonOverrides = {}) => {
  const json = {
    product_id: 1,
    product_name: "Gaming Laptop X",
    slug: "gaming-laptop-x",
    is_active: true,
    view_count: 10,
    specs: {},
    variations: [{ variation_id: 10, price: "20000000", is_primary: true }],
    images: [],
    questions: [],
    Tags: [],
    ...jsonOverrides,
  }

  const instance = {
    increment: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn(() => ({ ...json })),
  }

  return { instance, json }
}

const getTagInclude = () => {
  const opts = Product.findOne.mock.calls.at(-1)[0]
  return opts.include.find((inc) => inc.model === Tag)
}

const normalizeTags = (product) => product?.Tags ?? product?.tags ?? []

describe("GET /api/products/:id — product Tags in detail (getProductDetail)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: AC1 — eager-load Tags với metadata đầy đủ
  it("returns 200 with two tags including tag_id, tag_name, and slug (AC1)", async () => {
    const tags = [
      { tag_id: 3, tag_name: "Gaming", slug: "gaming" },
      { tag_id: 7, tag_name: "RTX Series", slug: "rtx-series" },
    ]
    const { instance } = buildMockProduct({ Tags: tags })
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/1")

    expect(res.status).toBe(200)
    const responseTags = normalizeTags(res.body.product)
    expect(responseTags).toHaveLength(2)
    expect(responseTags[0]).toMatchObject({
      tag_id: 3,
      tag_name: "Gaming",
      slug: "gaming",
    })
    expect(responseTags[1]).toMatchObject({
      tag_id: 7,
      tag_name: "RTX Series",
      slug: "rtx-series",
    })
    expect(instance.increment).toHaveBeenCalledWith("view_count")
  })

  // FR: AC2 / BR-01 — không có tag vẫn 200
  it("returns 200 with empty Tags array when product has no tags (AC2, BR-01)", async () => {
    const { instance } = buildMockProduct({ Tags: [] })
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/1")

    expect(res.status).toBe(200)
    expect(normalizeTags(res.body.product)).toEqual([])
  })

  // FR: AC4 / BR-02 — include Tag, không lấy pivot attributes
  it("includes Tag association with through.attributes empty array (AC4, BR-02)", async () => {
    const { instance } = buildMockProduct({
      Tags: [{ tag_id: 1, tag_name: "Ultrabook", slug: "ultrabook" }],
    })
    Product.findOne.mockResolvedValue(instance)

    await request(app).get("/api/products/1")

    const tagInclude = getTagInclude()
    expect(tagInclude).toBeDefined()
    expect(tagInclude.model).toBe(Tag)
    expect(tagInclude.through).toEqual({ attributes: [] })
  })

  // FR: AC4 — JSON không lộ junction/pivot fields
  it("does not expose pivot or junction fields on tag objects in JSON (AC4)", async () => {
    const { instance } = buildMockProduct({
      Tags: [
        {
          tag_id: 5,
          tag_name: "New",
          slug: "new",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    })
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/1")

    const tag = normalizeTags(res.body.product)[0]
    expect(tag).toMatchObject({ tag_id: 5, tag_name: "New", slug: "new" })
    expect(tag).not.toHaveProperty("product_tags")
    expect(tag).not.toHaveProperty("ProductTag")
    expect(tag).not.toHaveProperty("product_id")
  })

  // FR: BR-02 — không tìm thấy SP
  it("returns 404 without product Tags when product is not found (BR-02)", async () => {
    Product.findOne.mockResolvedValue(null)

    const res = await request(app).get("/api/products/999")

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
    expect(res.body.product).toBeUndefined()
    expect(res.body.Tags).toBeUndefined()
  })
})
