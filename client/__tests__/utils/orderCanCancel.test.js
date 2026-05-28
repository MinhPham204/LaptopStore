import { describe, it, expect } from "vitest"
import { canCancel } from "../../app/utils/orderCanCancel.js"

describe("canCancel (orderCanCancel.js)", () => {
  // FR: AC6 — mirror backend §4 guards
  it("returns true for VNPAY AWAITING_PAYMENT + pending (AC6, §4)", () => {
    expect(
      canCancel({
        status: "AWAITING_PAYMENT",
        payment: { provider: "VNPAY", payment_status: "pending" },
      })
    ).toBe(true)
  })

  it("returns true for COD processing + pending (AC6, §4)", () => {
    expect(
      canCancel({
        status: "processing",
        payment: { provider: "COD", payment_status: "pending" },
      })
    ).toBe(true)
  })

  it("returns true for VNPAY processing + completed (AC6, §4)", () => {
    expect(
      canCancel({
        status: "processing",
        payment: { provider: "VNPAY", payment_status: "completed" },
      })
    ).toBe(true)
  })

  it("returns false for shipping orders (AC6)", () => {
    expect(
      canCancel({
        status: "shipping",
        payment: { provider: "COD", payment_status: "pending" },
      })
    ).toBe(false)
  })

  it("returns false for VNPAY processing + pending (AC6)", () => {
    expect(
      canCancel({
        status: "processing",
        payment: { provider: "VNPAY", payment_status: "pending" },
      })
    ).toBe(false)
  })
})
