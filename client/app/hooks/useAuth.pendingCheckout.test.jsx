import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

const mockDispatch = vi.fn()
const mockRemoveQueries = vi.fn()

vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ removeQueries: mockRemoveQueries }),
}))

vi.mock("../services/api", () => ({
  default: { defaults: { headers: { common: {} } } },
}))

vi.mock("../store/slices/authSlice", () => ({
  logout: () => ({ type: "auth/logout" }),
}))

vi.mock("../store/slices/cartSlice", () => ({
  clearCart: () => ({ type: "cart/clear" }),
}))

import { useLogout } from "./useAuth"

describe("useLogout — pendingCheckout cleanup", () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockRemoveQueries.mockClear()
    localStorage.clear()
    localStorage.setItem("pendingCheckout", JSON.stringify({ mode: "buy_now", items: [] }))
    localStorage.setItem("token", "jwt")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // FR: §7 useAuth — logout clears key
  it("removes pendingCheckout from localStorage on logout (§7)", () => {
    const { result } = renderHook(() => useLogout())

    act(() => {
      result.current()
    })

    expect(localStorage.getItem("pendingCheckout")).toBeNull()
    expect(localStorage.getItem("token")).toBeNull()
  })
})
