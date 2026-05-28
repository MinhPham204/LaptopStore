import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
}))

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector) => selector({ auth: { isAuthenticated: mocks.isAuthenticated } }),
}))

vi.mock("react-router-dom", () => ({
  BrowserRouter: ({ children }) => <div data-testid="router">{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: () => null,
}))

vi.mock("./components/Layout", () => ({ default: ({ children }) => children }))
vi.mock("./components/Footer", () => ({ default: () => null }))
vi.mock("./components/ProtectedRoute", () => ({ default: ({ children }) => children }))
vi.mock("./components/AdminRoute", () => ({ default: ({ children }) => children }))

vi.mock("./pages/HomePage", () => ({ default: () => null }))
vi.mock("./pages/ProductDetailPage", () => ({ default: () => null }))
vi.mock("./pages/CartPage", () => ({ default: () => null }))
vi.mock("./pages/CheckoutPage", () => ({ default: () => null }))
vi.mock("./pages/LoginPage", () => ({ default: () => null }))
vi.mock("./pages/RegisterPage", () => ({ default: () => null }))
vi.mock("./pages/ProfilePage", () => ({ default: () => null }))
vi.mock("./pages/OrdersPage", () => ({ default: () => null }))
vi.mock("./pages/checkout/VnpayReturn", () => ({ default: () => null }))
vi.mock("./pages/OrderDetailPage", () => ({ default: () => null }))
vi.mock("./pages/CheckoutSuccessPage", () => ({ default: () => null }))
vi.mock("./pages/OAuthSuccess", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminDashboard", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminProducts", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminOrders", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminUsers", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminCategories", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminBrands", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminQuestions", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminQuestionDetail", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminProductNewPage", () => ({ default: () => null }))
vi.mock("./pages/admin/AdminProductEditPage", () => ({ default: () => null }))

import App from "./App"

const renderAppAuthenticated = () => {
  mocks.isAuthenticated = true
  localStorage.setItem("token", "jwt")
  localStorage.setItem("user", JSON.stringify({ username: "buyer" }))
  render(<App />)
}

describe("App — pendingCheckout TTL cleanup", () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.isAuthenticated = false
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // FR: §7 BR-01 / BR-02 — stale timestamp removed
  it("removes pendingCheckout older than 5 minutes when authenticated (§7, BR-02)", () => {
    const sixMinutesAgo = Date.now() - 6 * 60 * 1000
    localStorage.setItem(
      "pendingCheckout",
      JSON.stringify({ mode: "buy_now", items: [], timestamp: sixMinutesAgo })
    )

    renderAppAuthenticated()

    expect(localStorage.getItem("pendingCheckout")).toBeNull()
  })

  // FR: §7 — fresh timestamp kept
  it("keeps pendingCheckout younger than 5 minutes when authenticated (§7)", () => {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000
    const payload = { mode: "buy_now", items: [], timestamp: twoMinutesAgo }
    localStorage.setItem("pendingCheckout", JSON.stringify(payload))

    renderAppAuthenticated()

    expect(JSON.parse(localStorage.getItem("pendingCheckout"))).toEqual(payload)
  })

  // FR: §7 BR-01 — missing timestamp treated as 0 → removed
  it("removes pendingCheckout without timestamp when authenticated (§7, BR-01)", () => {
    localStorage.setItem(
      "pendingCheckout",
      JSON.stringify({ mode: "buy_now", items: [] })
    )

    renderAppAuthenticated()

    expect(localStorage.getItem("pendingCheckout")).toBeNull()
  })
})
