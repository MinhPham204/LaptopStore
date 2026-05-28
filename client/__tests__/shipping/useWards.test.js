import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

const mockGet = vi.fn()

vi.mock("../../app/services/api", () => ({
  default: {
    get: (...args) => mockGet(...args),
  },
}))

import { useWards } from "../../app/hooks/useWards.js"

const mockWardsHcm = [
  {
    ward_id: 12345,
    name: "Phường Hiệp Bình Chánh",
    slug: "hiep-binh-chanh",
    extra_fee: 5000,
    province_id: 79,
  },
]

const mockWardsAnGiang = [
  {
    ward_id: 20001,
    name: "Phường Mỹ Bình",
    slug: "my-binh",
    extra_fee: 2000,
    province_id: 1,
  },
]

describe("useWards", () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: mockWardsHcm })
  })

  // FR: §6 / AC — fetch by province
  it("calls GET /provinces/79/wards when provinceId is 79 (§6, AC)", async () => {
    renderHook(() => useWards(79))

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1)
    })
    expect(mockGet).toHaveBeenCalledWith("/provinces/79/wards")
  })

  // FR: §6 — data populated
  it("populates data from API response (§6)", async () => {
    const { result } = renderHook(() => useWards(79))

    await waitFor(() => {
      expect(result.current.data).toEqual(mockWardsHcm)
    })
  })

  // FR: §6 — loading lifecycle
  it("sets loading true then false when provinceId is set (§6)", async () => {
    let resolveGet
    mockGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve
        })
    )

    const { result } = renderHook(() => useWards(79))

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveGet({ data: mockWardsHcm })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  // FR: BR-02 — province change refetch
  it("refetches wards when provinceId changes (BR-02)", async () => {
    mockGet
      .mockResolvedValueOnce({ data: mockWardsHcm })
      .mockResolvedValueOnce({ data: mockWardsAnGiang })

    const { result, rerender } = renderHook(({ provinceId }) => useWards(provinceId), {
      initialProps: { provinceId: 79 },
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockWardsHcm)
    })

    rerender({ provinceId: 1 })

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/provinces/1/wards")
      expect(result.current.data).toEqual(mockWardsAnGiang)
    })

    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  // FR: BR-01 — falsy provinceId
  it.each([
    ["null", null],
    ["empty string", ""],
    ["undefined", undefined],
  ])("does not call api and keeps data empty when provinceId is %s (BR-01)", async (_label, provinceId) => {
    const { result } = renderHook(() => useWards(provinceId))

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockGet).not.toHaveBeenCalled()
    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  // FR: §6 — unmount cleanup
  it("does not update state after unmount when request resolves late (§6)", async () => {
    let resolveGet
    mockGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve
        })
    )

    const { result, unmount } = renderHook(() => useWards(79))

    unmount()

    await act(async () => {
      resolveGet({ data: mockWardsHcm })
      await Promise.resolve()
    })

    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(true)
  })
})
