const request = require("supertest")
const express = require("express")

jest.mock("../../models/Province", () => ({
  findByPk: jest.fn(),
}))

jest.mock("../../models/Ward", () => ({
  findByPk: jest.fn(),
}))

const Province = require("../../models/Province")
const Ward = require("../../models/Ward")
const shippingRoutes = require("../../routes/shippingRoutes")

const app = express()
app.use(express.json())
app.use("/api", shippingRoutes)

const QUOTE_URL = "/api/quote"

const PROVINCE_ID = 79
const WARD_ID = 12345

describe("GET /api/quote (shippingRoutes + shippingController)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Province.findByPk.mockResolvedValue({
      province_id: PROVINCE_ID,
      base_shipping_fee: 30_000,
      is_free_shipping: false,
      is_hcm: true,
      max_shipping_fee: 150_000,
    })
    Ward.findByPk.mockResolvedValue({
      ward_id: WARD_ID,
      extra_fee: 5_000,
      province_id: PROVINCE_ID,
    })
  })

  // FR: §5 — 200 mirrors quoteShipping
  it("returns 200 with shipping_fee and reason from quoteShipping (§5)", async () => {
    const res = await request(app).get(QUOTE_URL).query({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 1_500_000,
    })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      shipping_fee: 0,
      reason: "HCM_SUBTOTAL_FREE",
    })
    expect(Province.findByPk).toHaveBeenCalledWith(PROVINCE_ID)
    expect(Ward.findByPk).toHaveBeenCalledWith(WARD_ID)
  })

  // FR: §5 — base + ward via HTTP
  it("returns 200 with computed fee when HCM subtotal freeship does not apply (§5)", async () => {
    const res = await request(app).get(QUOTE_URL).query({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 500_000,
    })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ shipping_fee: 35_000 })
  })

  // FR: §5 — ward_id omitted
  it("returns 200 when ward_id is omitted and does not load ward (§5)", async () => {
    const res = await request(app).get(QUOTE_URL).query({
      province_id: PROVINCE_ID,
      subtotal: 100_000,
    })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ shipping_fee: 30_000 })
    expect(Ward.findByPk).not.toHaveBeenCalled()
  })

  // FR: §5 — subtotal defaults to 0
  it("defaults subtotal to 0 when query param is missing (§5)", async () => {
    const res = await request(app).get(QUOTE_URL).query({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
    })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ shipping_fee: 35_000 })
  })

  // FR: §5 — public no auth
  it("returns 200 without Authorization header (§5)", async () => {
    const res = await request(app)
      .get(QUOTE_URL)
      .query({ province_id: PROVINCE_ID, ward_id: WARD_ID, subtotal: 0 })
      .unset("Authorization")

    expect(res.status).toBe(200)
    expect(res.body.shipping_fee).toBe(35_000)
  })

  // FR: §5 — negative 500
  it('returns 500 with error QUOTE_FAILED when quoteShipping throws (§5)', async () => {
    Province.findByPk.mockRejectedValue(new Error("Quote DB error"))

    const res = await request(app).get(QUOTE_URL).query({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 1_000_000,
    })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "QUOTE_FAILED" })
  })
})
