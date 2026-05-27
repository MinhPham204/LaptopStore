import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, waitFor } from "@testing-library/react"
import { setCredentials } from "../store/slices/authSlice"

const {
  mockNavigate,
  mockDispatch,
  mockApiGet,
  mockApi,
} = vi.hoisted(() => {
  const mockNavigate = vi.fn()
  const mockDispatch = vi.fn()
  const mockApiGet = vi.fn()
  const mockApi = {
    get: mockApiGet,
    defaults: { headers: { common: {} } },
  }
  return { mockNavigate, mockDispatch, mockApiGet, mockApi }
})

let mockSearchParams = new URLSearchParams()

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}))

vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
}))

vi.mock("../services/api", () => ({
  default: mockApi,
}))

import OAuthSuccess from "./OAuthSuccess"

const mockUser = {
  user_id: 42,
  username: "oauthuser",
  email: "oauth@example.com",
  roles: ["customer"],
}

const renderPage = () => render(<OAuthSuccess />)

describe("OAuthSuccess", () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockDispatch.mockClear()
    mockApiGet.mockReset()
    mockApi.defaults.headers.common = {}
    localStorage.clear()
    mockSearchParams = new URLSearchParams()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // FR: AC1 — token hợp lệ + /me OK → credentials + redirect home
  it("sets credentials and navigates to home when token and /me succeed", async () => {
    mockSearchParams = new URLSearchParams("token=session-jwt")
    mockApiGet.mockResolvedValue({ data: { user: mockUser } })

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true })
    })

    expect(mockApiGet).toHaveBeenCalledWith("/auth/me")
    expect(mockApi.defaults.headers.common.Authorization).toBe("Bearer session-jwt")
    expect(localStorage.getItem("token")).toBe("session-jwt")
    expect(mockDispatch).toHaveBeenCalledWith(
      setCredentials({ token: "session-jwt", user: mockUser })
    )
  })

  // FR: AC4 — pendingCheckout hợp lệ → checkout + xóa key
  it("navigates to checkout with state when pendingCheckout is valid JSON", async () => {
    mockSearchParams = new URLSearchParams("token=session-jwt")
    mockApiGet.mockResolvedValue({ data: { user: mockUser } })
    const checkoutState = { variation_id: 10, quantity: 2 }
    localStorage.setItem("pendingCheckout", JSON.stringify(checkoutState))

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/checkout", {
        state: checkoutState,
        replace: true,
      })
    })

    expect(localStorage.getItem("pendingCheckout")).toBeNull()
    expect(mockDispatch).toHaveBeenCalledWith(
      setCredentials({ token: "session-jwt", user: mockUser })
    )
  })

  // FR: AC2 — không có token → login oauth=missing
  it("navigates to login with oauth=missing when token is absent", async () => {
    mockSearchParams = new URLSearchParams()

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login?oauth=missing", { replace: true })
    })

    expect(mockApiGet).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  // FR: AC3 — /me fail → login oauth=failed
  it("navigates to login with oauth=failed when /me rejects", async () => {
    mockSearchParams = new URLSearchParams("token=bad-jwt")
    mockApiGet.mockRejectedValue(new Error("Unauthorized"))

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login?oauth=failed", { replace: true })
    })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  // FR: AC5 — success paths dùng replace: true (home)
  it("uses replace true when navigating to home after success", async () => {
    mockSearchParams = new URLSearchParams("token=session-jwt")
    mockApiGet.mockResolvedValue({ data: { user: mockUser } })

    renderPage()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    const [, homeOptions] = mockNavigate.mock.calls.find(([path]) => path === "/") || []
    expect(homeOptions).toEqual({ replace: true })
  })

  // FR: AC5 — success paths dùng replace: true (checkout)
  it("uses replace true when navigating to checkout after success", async () => {
    mockSearchParams = new URLSearchParams("token=session-jwt")
    mockApiGet.mockResolvedValue({ data: { user: mockUser } })
    localStorage.setItem("pendingCheckout", JSON.stringify({ variation_id: 1 }))

    renderPage()

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/checkout",
        expect.objectContaining({ replace: true })
      )
    )
  })

  // FR: negative — pendingCheckout JSON lỗi → vẫn về "/" sau /me OK
  it("navigates to home when pendingCheckout JSON is invalid", async () => {
    mockSearchParams = new URLSearchParams("token=session-jwt")
    mockApiGet.mockResolvedValue({ data: { user: mockUser } })
    localStorage.setItem("pendingCheckout", "not-valid-json{{{")
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true })
    })

    expect(consoleSpy).toHaveBeenCalled()
    expect(localStorage.getItem("pendingCheckout")).toBe("not-valid-json{{{")
    consoleSpy.mockRestore()
  })
})
