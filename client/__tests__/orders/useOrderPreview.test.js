import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

const mockPost = vi.fn()

vi.mock("../../app/services/api", () => ({
  default: {
    post: (...args) => mockPost(...args),
  },
}))

import { useOrderPreview } from "../../app/hooks/useOrderPreview.js"

const viewItems = [{ variation_id: 101, quantity: 2 }]

const previewResponse = {
  subtotal_after_discount: 20_000_000,
  shipping_fee: 30_000,
  final_amount: 20_030_000,
}

describe("useOrderPreview", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPost.mockReset()
    mockPost.mockResolvedValue({ data: previewResponse })
    localStorage.setItem("token", "test-token")
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  // FR: §7 — không gọi khi thiếu items
  it("does not call preview API when viewItems is empty (§7)", async () => {
    renderHook(() =>
      useOrderPreview({ provinceId: "1", wardId: "2", viewItems: [] })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(mockPost).not.toHaveBeenCalled()
  })

  // FR: §7 — không gọi khi chưa chọn province
  it("does not call preview API when provinceId is missing (§7)", async () => {
    renderHook(() =>
      useOrderPreview({ provinceId: "", wardId: "2", viewItems })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(mockPost).not.toHaveBeenCalled()
  })

  // FR: §7 — debounce 500ms rồi POST /orders/preview
  it("calls POST /orders/preview after 500ms debounce (§7)", async () => {
    const { result } = renderHook(() =>
      useOrderPreview({ provinceId: "1", wardId: "2", viewItems })
    )

    expect(mockPost).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(result.current.data).toEqual(previewResponse)
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      "/orders/preview",
      {
        province_id: 1,
        ward_id: 2,
        items: [{ variation_id: 101, quantity: 2 }],
      },
      { headers: { Authorization: "Bearer test-token" } }
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // FR: §7 — đổi province chỉ gọi lần cuối sau debounce
  it("debounces rapid province changes to a single preview call (§7)", async () => {
    const { rerender } = renderHook(
      ({ provinceId }) =>
        useOrderPreview({ provinceId, wardId: "2", viewItems }),
      { initialProps: { provinceId: "1" } }
    )

    rerender({ provinceId: "2" })
    rerender({ provinceId: "3" })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost.mock.calls[0][1].province_id).toBe(3)
  })

  // FR: §7 — lỗi API
  it("sets error state when preview API fails (§7)", async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: "Preview failed" } },
    })

    const { result } = renderHook(() =>
      useOrderPreview({ provinceId: "1", wardId: null, viewItems })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(result.current.error).toBe("Preview failed")
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
