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

const { Product } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const buildMockProduct = () => {
  const json = {
    product_id: 1,
    product_name: "Laptop Configurable",
    slug: "laptop-configurable",
    is_active: true,
    specs: {},
    variations: [
      {
        variation_id: 101,
        price: "25000000",
        stock_quantity: 8,
        is_available: true,
        is_primary: true,
        processor: "Intel i7",
        ram: "16GB",
        storage: "512GB",
        graphics_card: "RTX 4060",
        screen_size: "15.6",
        color: "Black",
      },
      {
        variation_id: 102,
        price: "21000000",
        stock_quantity: 2,
        is_available: true,
        is_primary: false,
        processor: "Intel i5",
        ram: "8GB",
        storage: "256GB",
        graphics_card: "Integrated",
        screen_size: "15.6",
        color: "Silver",
      },
    ],
    images: [],
    Tags: [],
    questions: [],
  }

  return {
    instance: {
      increment: jest.fn().mockResolvedValue(undefined),
      toJSON: jest.fn(() => json),
    },
    json,
  }
}

describe("GET /api/products/:id — variation fields for select variation (FR)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: §9 — detail API exposes variation attributes for PDP picker
  it("returns variations with processor, ram, price, stock_quantity, is_primary", async () => {
    const { instance, json } = buildMockProduct()
    Product.findOne.mockResolvedValue(instance)

    const res = await request(app).get("/api/products/1")

    expect(res.status).toBe(200)
    expect(res.body.product.variations).toHaveLength(2)

    const primary = res.body.product.variations.find((v) => v.is_primary)
    expect(primary).toMatchObject({
      variation_id: 101,
      processor: "Intel i7",
      ram: "16GB",
      price: "25000000",
      stock_quantity: 8,
      is_primary: true,
    })

    const cheaper = res.body.product.variations.find((v) => v.variation_id === 102)
    expect(cheaper).toMatchObject({
      processor: "Intel i5",
      ram: "8GB",
      price: "21000000",
      stock_quantity: 2,
    })

    expect(Product.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product_id: "1" },
      })
    )

    const variationInclude = Product.findOne.mock.calls[0][0].include.find(
      (inc) => inc.as === "variations"
    )
    expect(variationInclude.attributes).toEqual(
      expect.arrayContaining([
        "variation_id",
        "price",
        "stock_quantity",
        "is_available",
        "is_primary",
        "processor",
        "ram",
        "storage",
        "graphics_card",
        "screen_size",
        "color",
      ])
    )

    expect(json.variations[0].variation_id).toBe(101)
  })

  // Negative — product not found
  it("returns 404 when product is not found", async () => {
    Product.findOne.mockResolvedValue(null)

    const res = await request(app).get("/api/products/999")

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
  })
})
