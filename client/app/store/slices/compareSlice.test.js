import { describe, it, expect } from "vitest"
import reducer, {
  addCompare,
  removeCompare,
  clearCompare,
} from "./compareSlice.js"

const makeItem = (variation_id, overrides = {}) => ({
  variation_id,
  product_id: 100 + variation_id,
  product_name: `Product ${variation_id}`,
  thumbnail_url: `/thumb-${variation_id}.png`,
  discount_percentage: 10,
  specs: {
    price: 20000000 + variation_id,
    processor: "Intel",
    ram: "16GB",
  },
  variation: { variation_id, price: 20000000 + variation_id },
  ...overrides,
})

const run = (state, action) => reducer(state, action)

describe("compareSlice reducer", () => {
  // FR: AC1 — add compare → item in list
  it("adds a new item to compare list (AC1)", () => {
    const item = makeItem(1)
    const next = run({ items: [] }, addCompare(item))

    expect(next.items).toHaveLength(1)
    expect(next.items[0].variation_id).toBe(1)
    expect(next.items[0].product_name).toBe("Product 1")
  })

  // FR: BR-02 / AC1 — duplicate variation_id is no-op
  it("does not add duplicate variation_id (BR-02, AC1)", () => {
    const first = makeItem(1)
    const dup = makeItem(1, { product_name: "Duplicate name" })
    let state = run({ items: [] }, addCompare(first))
    state = run(state, addCompare(dup))

    expect(state.items).toHaveLength(1)
    expect(state.items[0].product_name).toBe("Product 1")
  })

  // FR: BR-01 / AC2 — max 3 FIFO evict oldest
  it("evicts oldest item when adding a fourth (BR-01, AC2)", () => {
    let state = { items: [] }
    ;[1, 2, 3].forEach((id) => {
      state = run(state, addCompare(makeItem(id)))
    })
    expect(state.items.map((x) => x.variation_id)).toEqual([1, 2, 3])

    state = run(state, addCompare(makeItem(4)))
    expect(state.items).toHaveLength(3)
    expect(state.items.map((x) => x.variation_id)).toEqual([2, 3, 4])
  })

  // FR: BR-01 — never exceeds 3 items
  it("keeps at most 3 items after multiple adds (BR-01)", () => {
    let state = { items: [] }
    ;[10, 11, 12, 13, 14].forEach((id) => {
      state = run(state, addCompare(makeItem(id)))
    })
    expect(state.items).toHaveLength(3)
    expect(state.items.map((x) => x.variation_id)).toEqual([12, 13, 14])
  })

  // FR: AC1 — remove by variation_id
  it("removes item by variation_id (AC1)", () => {
    let state = { items: [makeItem(1), makeItem(2)] }
    state = run(state, removeCompare(1))

    expect(state.items).toHaveLength(1)
    expect(state.items[0].variation_id).toBe(2)
  })

  // FR: AC1 — remove non-existent is safe
  it("removeCompare with unknown variation_id leaves list unchanged", () => {
    const state = run({ items: [makeItem(1)] }, removeCompare(999))
    expect(state.items).toHaveLength(1)
  })

  // FR: AC5 / BR-01 — clear all
  it("clears all compare items (AC5)", () => {
    const state = run(
      { items: [makeItem(1), makeItem(2), makeItem(3)] },
      clearCompare()
    )
    expect(state.items).toEqual([])
  })
})
