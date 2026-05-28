jest.mock("../../models/Province", () => ({
  findByPk: jest.fn(),
}))

jest.mock("../../models/Ward", () => ({
  findByPk: jest.fn(),
}))

const Province = require("../../models/Province")
const Ward = require("../../models/Ward")
const { quoteShipping } = require("../../services/shippingService")

const PROVINCE_ID = 79
const WARD_ID = 12345

const normalProvince = {
  province_id: PROVINCE_ID,
  base_shipping_fee: 30_000,
  is_free_shipping: false,
  is_hcm: false,
  max_shipping_fee: 150_000,
}

const hcmProvince = {
  province_id: PROVINCE_ID,
  base_shipping_fee: 30_000,
  is_free_shipping: false,
  is_hcm: true,
  max_shipping_fee: 150_000,
}

const freeProvince = {
  province_id: 1,
  base_shipping_fee: 40_000,
  is_free_shipping: true,
  is_hcm: false,
  max_shipping_fee: null,
}

const mockWard = {
  ward_id: WARD_ID,
  extra_fee: 5_000,
  province_id: PROVINCE_ID,
}

describe("quoteShipping (shippingService.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: §4 step 1
  it('returns shipping_fee 0 and reason NO_PROVINCE when province is missing (§4)', async () => {
    Province.findByPk.mockResolvedValue(null)

    const result = await quoteShipping({
      province_id: 99999,
      ward_id: WARD_ID,
      subtotal: 500_000,
    })

    expect(result).toEqual({ shipping_fee: 0, reason: "NO_PROVINCE" })
    expect(Ward.findByPk).not.toHaveBeenCalled()
  })

  // FR: §4 step 2 — ward extra not applied
  it("returns FREE_BY_PROVINCE without adding ward extra_fee (§4)", async () => {
    Province.findByPk.mockResolvedValue(freeProvince)

    const result = await quoteShipping({
      province_id: freeProvince.province_id,
      ward_id: WARD_ID,
      subtotal: 2_000_000,
    })

    expect(result).toEqual({ shipping_fee: 0, reason: "FREE_BY_PROVINCE" })
    expect(Ward.findByPk).not.toHaveBeenCalled()
  })

  // FR: §4 step 3 — base + ward
  it("returns base_shipping_fee plus ward extra_fee when no freeship rules apply (§4)", async () => {
    Province.findByPk.mockResolvedValue(normalProvince)
    Ward.findByPk.mockResolvedValue(mockWard)

    const result = await quoteShipping({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 500_000,
    })

    expect(result).toEqual({ shipping_fee: 35_000 })
    expect(Ward.findByPk).toHaveBeenCalledWith(WARD_ID)
  })

  // FR: §4 step 4
  it("returns HCM_SUBTOTAL_FREE when is_hcm and subtotal >= 1_000_000 (§4)", async () => {
    Province.findByPk.mockResolvedValue(hcmProvince)
    Ward.findByPk.mockResolvedValue(mockWard)

    const result = await quoteShipping({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 1_500_000,
    })

    expect(result).toEqual({ shipping_fee: 0, reason: "HCM_SUBTOTAL_FREE" })
  })

  // FR: §4 step 5
  it("caps fee at max_shipping_fee when total exceeds cap (§4)", async () => {
    Province.findByPk.mockResolvedValue({
      ...normalProvince,
      base_shipping_fee: 50_000,
      max_shipping_fee: 40_000,
    })
    Ward.findByPk.mockResolvedValue({ ...mockWard, extra_fee: 20_000 })

    const result = await quoteShipping({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 500_000,
    })

    expect(result).toEqual({ shipping_fee: 40_000 })
  })

  // FR: §4 step 6
  it("rounds fee with Math.round and never returns negative (§4)", async () => {
    Province.findByPk.mockResolvedValue({
      ...normalProvince,
      base_shipping_fee: 10_000.6,
      max_shipping_fee: null,
    })
    Ward.findByPk.mockResolvedValue({ ...mockWard, extra_fee: 5_000.4 })

    const result = await quoteShipping({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 100_000,
    })

    expect(result).toEqual({ shipping_fee: 15_001 })
  })

  // FR: §4 — ward_id given but ward not found
  it("uses only base_shipping_fee when ward_id is provided but ward is missing (§4)", async () => {
    Province.findByPk.mockResolvedValue(normalProvince)
    Ward.findByPk.mockResolvedValue(null)

    const result = await quoteShipping({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 500_000,
    })

    expect(result).toEqual({ shipping_fee: 30_000 })
    expect(Ward.findByPk).toHaveBeenCalledWith(WARD_ID)
  })

  // FR: §4 step 6 — normal fee without reason
  it("returns rounded shipping_fee without reason for standard province fee (§4)", async () => {
    Province.findByPk.mockResolvedValue({
      ...normalProvince,
      base_shipping_fee: 25_000,
      max_shipping_fee: 100_000,
    })
    Ward.findByPk.mockResolvedValue({ ...mockWard, extra_fee: 3_000 })

    const result = await quoteShipping({
      province_id: PROVINCE_ID,
      ward_id: WARD_ID,
      subtotal: 800_000,
    })

    expect(result).toEqual({ shipping_fee: 28_000 })
    expect(result.reason).toBeUndefined()
  })
})
