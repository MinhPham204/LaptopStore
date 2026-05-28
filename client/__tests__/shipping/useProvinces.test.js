import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

const mockGet = vi.fn()

vi.mock("../../app/services/api", () => ({
  default: {
    get: (...args) => mockGet(...args),
  },
}))

import { useProvinces } from "../../app/hooks/useProvinces.js"

const mockProvinces = [
  {
    province_id: 79,
    name: "Thành phố Hồ Chí Minh",
    slug: "ho-chi-minh",
    is_hcm: true,
    base_shipping_fee: 30000,
    is_free_shipping: false,
    max_shipping_fee: 150000,
  },
]

describe("useProvinces", () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: mockProvinces })
  })

  // FR: §6 — fetch on mount
  it("calls GET /provinces once on mount (§6)", async () => {
    renderHook(() => useProvinces())

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1)
    })
    expect(mockGet).toHaveBeenCalledWith("/provinces")
  })

  // FR: §6 — data populated
  it("populates data from API response (§6)", async () => {
    const { result } = renderHook(() => useProvinces())

    await waitFor(() => {
      expect(result.current.data).toEqual(mockProvinces)
    })
  })

  // FR: §6 — loading settles
  it("sets loading to false after fetch resolves (§6)", async () => {
    const { result } = renderHook(() => useProvinces())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  // FR: §6 — mounted cleanup
  it("does not update state after unmount when request resolves late (§6)", async () => {
    let resolveGet
    mockGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve
        })
    )

    const { result, unmount } = renderHook(() => useProvinces())

    expect(mockGet).toHaveBeenCalledTimes(1)
    unmount()

    await act(async () => {
      resolveGet({ data: mockProvinces })
      await Promise.resolve()
    })

    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  // FR: §6 — error path (hook has no .catch; absorb rejection in test)
  it("sets loading false and keeps data empty when api.get rejects (§6)", async () => {
    const networkError = new Error("Network error")
    const rejectionHandled = new Promise((resolve) => {
      process.once("unhandledRejection", (reason) => {
        expect(reason).toBe(networkError)
        resolve()
      })
    })

    mockGet.mockRejectedValue(networkError)

    const { result } = renderHook(() => useProvinces())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    await rejectionHandled
  })

  // FR: GAP-03 — ignored argument (CheckoutPage passes true)
  it("ignores arguments and still calls GET /provinces (GAP-03)", async () => {
    renderHook(() => useProvinces(true))

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/provinces")
    })
  })
})
