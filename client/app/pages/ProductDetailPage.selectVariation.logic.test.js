import { describe, it, expect } from "vitest"

// Copied from ProductDetailPage.jsx — not exported from production
const ATTRS = [
  "processor",
  "ram",
  "storage",
  "graphics_card",
  "screen_size",
  "color",
]

const emptySel = () => ATTRS.reduce((o, k) => ({ ...o, [k]: "" }), {})

const matchVariation = (v, s) =>
  ATTRS.every((k) => !s[k] || String(v[k]) === String(s[k]))

const buildUniqueOptions = (variations = []) =>
  ATTRS.reduce((acc, key) => {
    const set = new Set(variations.map((v) => v[key]).filter(Boolean))
    acc[key] = [...set]
    return acc
  }, {})

const evaluateSelection = (product, sel) => {
  const variations = product.variations || []
  const uniqueOptions = buildUniqueOptions(variations)
  const matched = variations.find((v) => matchVariation(v, sel))
  const requiredKeys = ATTRS.filter((k) => (uniqueOptions[k] || []).length > 0)
  const allSelected = requiredKeys.every((k) => !!sel[k])
  const isReady = Boolean(matched) && allSelected
  return { matched, isReady, uniqueOptions, requiredKeys, allSelected }
}

const isDisabled = (product, sel, k, val) => {
  const s = { ...sel, [k]: val }
  return !(product.variations || []).some((v) => matchVariation(v, s))
}

const pickDefaultVariation = (variations = []) => {
  if (!variations.length) {
    return { variation: null, sel: emptySel() }
  }

  const primaryVariation = variations.find((v) => v.is_primary === true)
  let defaultVariation
  if (primaryVariation) {
    defaultVariation = primaryVariation
  } else {
    defaultVariation = variations.reduce((cheapest, current) => {
      const currentPrice = Number(current.price || 0)
      const cheapestPrice = Number(cheapest.price || 0)
      return currentPrice < cheapestPrice ? current : cheapest
    }, variations[0])
  }

  const sel = ATTRS.reduce((acc, attr) => {
    acc[attr] = defaultVariation[attr] || ""
    return acc
  }, {})

  return { variation: defaultVariation, sel }
}

const getValidationReason = ({ product, sel, quantity = 1 }) => {
  const { matched, isReady } = evaluateSelection(product, sel)
  const productInactive = product?.is_active === false
  const selectedVar = matched || null
  const stockQty = Number(selectedVar?.stock_quantity ?? 0)
  const varAvailable = selectedVar ? selectedVar.is_available !== false : false
  const qty = Math.max(1, Number(quantity) || 1)

  if (productInactive) return "inactive"
  if (!isReady) return "choose-attrs"
  if (stockQty === 0) return "out-of-stock"
  if (!varAvailable) return "soldout"
  if (qty > stockQty) return "exceed-stock"
  return null
}

const computeFinalPrice = (selectedVariation, product, discountPct = 0) => {
  const currentVariation = selectedVariation || product.variations?.[0]
  const price = Number(currentVariation?.price) || 0
  return price * (1 - discountPct / 100)
}

const resetSelection = () => ({
  sel: emptySel(),
  selectedVariation: null,
})

const toggleSelect = (product, sel, k, val) => {
  const next = { ...sel, [k]: sel[k] === val ? "" : val }
  const m = (product.variations || []).find((v) => matchVariation(v, next))
  return { sel: next, selectedVariation: m || null }
}

const baseProduct = {
  product_id: 1,
  is_active: true,
  discount_percentage: 10,
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
      graphics_card: "Integrated",
      screen_size: "14",
      color: "Silver",
    },
    {
      variation_id: 11,
      price: "22000000",
      stock_quantity: 3,
      is_available: true,
      is_primary: false,
      processor: "M3",
      ram: "8GB",
      storage: "256GB",
      graphics_card: "Integrated",
      screen_size: "14",
      color: "Gray",
    },
    {
      variation_id: 12,
      price: "24000000",
      stock_quantity: 0,
      is_available: true,
      is_primary: false,
      processor: "M3 Pro",
      ram: "16GB",
      storage: "512GB",
      graphics_card: "Integrated",
      screen_size: "14",
      color: "Black",
    },
  ],
}

describe("pickDefaultVariation", () => {
  // FR: AC1 — ưu tiên is_primary
  it("picks primary variation when is_primary exists (AC1)", () => {
    const { variation, sel } = pickDefaultVariation(baseProduct.variations)

    expect(variation.variation_id).toBe(10)
    expect(sel).toMatchObject({
      processor: "M3",
      ram: "16GB",
      storage: "512GB",
    })
    expect(evaluateSelection(baseProduct, sel).isReady).toBe(true)
  })

  // FR: AC1 fallback — không có primary → giá thấp nhất
  it("picks cheapest variation when no primary flag (AC1 fallback)", () => {
    const variations = baseProduct.variations.map((v) => ({
      ...v,
      is_primary: false,
    }))

    const { variation } = pickDefaultVariation(variations)

    expect(variation.variation_id).toBe(11)
    expect(Number(variation.price)).toBe(22000000)
  })
})

describe("matchVariation / isReady / isDisabled", () => {
  // FR: AC2 — chọn đủ attributes khớp 1 SKU
  it("sets isReady true and finalPrice for a full valid selection (AC2)", () => {
    const sel = {
      processor: "M3",
      ram: "8GB",
      storage: "256GB",
      graphics_card: "Integrated",
      screen_size: "14",
      color: "Gray",
    }
    const { matched, isReady } = evaluateSelection(baseProduct, sel)

    expect(isReady).toBe(true)
    expect(matched.variation_id).toBe(11)
    expect(computeFinalPrice(matched, baseProduct, 10)).toBe(19800000)
  })

  // FR: AC3 — combination không tồn tại
  it("returns isDisabled true when attribute combination does not exist (AC3)", () => {
    const sel = {
      processor: "M3",
      ram: "16GB",
      storage: "512GB",
      graphics_card: "Integrated",
      screen_size: "14",
      color: "",
    }

    expect(isDisabled(baseProduct, sel, "color", "Gray")).toBe(true)
    expect(isDisabled(baseProduct, sel, "color", "Silver")).toBe(false)
  })

  // FR: AC4 — matched variation_id cho add-to-cart guard
  it("exposes matched.variation_id when selection is complete (AC4)", () => {
    const { sel } = pickDefaultVariation(baseProduct.variations)
    const { matched, isReady } = evaluateSelection(baseProduct, sel)

    expect(isReady).toBe(true)
    expect(matched?.variation_id).toBe(10)
  })

  // FR: AC6 — reset xóa selection
  it("reset selection yields isReady false (AC6)", () => {
    const { sel } = resetSelection()
    const { isReady } = evaluateSelection(baseProduct, sel)

    expect(sel.processor).toBe("")
    expect(isReady).toBe(false)
  })
})

describe("toggleSelect edge cases", () => {
  // FR: §11 — chỉ 1 variation
  it("auto-ready when product has a single variation", () => {
    const product = {
      ...baseProduct,
      variations: [baseProduct.variations[0]],
    }
    const { sel, variation } = pickDefaultVariation(product.variations)
    const { isReady, matched } = evaluateSelection(product, sel)

    expect(variation.variation_id).toBe(10)
    expect(isReady).toBe(true)
    expect(matched.variation_id).toBe(10)
  })

  // FR: §11 — partial selection
  it("isReady false when only partial attributes are selected", () => {
    const sel = {
      ...emptySel(),
      processor: "M3",
      ram: "16GB",
    }
    const { isReady, matched } = evaluateSelection(baseProduct, sel)

    expect(matched?.variation_id).toBe(10)
    expect(isReady).toBe(false)
    expect(getValidationReason({ product: baseProduct, sel })).toBe("choose-attrs")
  })

  // FR: §11 — deselect chip (toggle same value)
  it("deselecting a chip clears attribute and breaks readiness", () => {
    const sel = {
      processor: "M3",
      ram: "8GB",
      storage: "256GB",
      graphics_card: "Integrated",
      screen_size: "14",
      color: "Gray",
    }
    const { sel: nextSel } = toggleSelect(baseProduct, sel, "color", "Gray")
    const { isReady, allSelected } = evaluateSelection(baseProduct, nextSel)

    expect(nextSel.color).toBe("")
    expect(allSelected).toBe(false)
    expect(isReady).toBe(false)
  })
})

describe("getValidationReason", () => {
  const readySel = {
    processor: "M3",
    ram: "16GB",
    storage: "512GB",
    graphics_card: "Integrated",
    screen_size: "14",
    color: "Silver",
  }

  it("returns inactive when product is not active", () => {
    expect(
      getValidationReason({
        product: { ...baseProduct, is_active: false },
        sel: readySel,
      })
    ).toBe("inactive")
  })

  it("returns choose-attrs when selection is incomplete", () => {
    expect(
      getValidationReason({
        product: baseProduct,
        sel: { ...emptySel(), processor: "M3" },
      })
    ).toBe("choose-attrs")
  })

  it("returns out-of-stock when matched variation has zero stock", () => {
    const sel = {
      processor: "M3 Pro",
      ram: "16GB",
      storage: "512GB",
      graphics_card: "Integrated",
      screen_size: "14",
      color: "Black",
    }
    expect(getValidationReason({ product: baseProduct, sel })).toBe("out-of-stock")
  })

  it("returns soldout when matched variation is not available", () => {
    const product = {
      ...baseProduct,
      variations: baseProduct.variations.map((v) =>
        v.variation_id === 10 ? { ...v, is_available: false } : v
      ),
    }
    expect(getValidationReason({ product, sel: readySel })).toBe("soldout")
  })

  it("returns exceed-stock when quantity exceeds stock", () => {
    expect(
      getValidationReason({
        product: baseProduct,
        sel: readySel,
        quantity: 99,
      })
    ).toBe("exceed-stock")
  })

  it("returns null when selection is valid and in stock", () => {
    expect(getValidationReason({ product: baseProduct, sel: readySel })).toBeNull()
  })
})
