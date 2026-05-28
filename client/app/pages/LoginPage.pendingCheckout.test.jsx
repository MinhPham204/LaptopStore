import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockMutateAsync: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.mockNavigate,
  useSearchParams: () => [mocks.searchParams],
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("../hooks/useAuth", () => ({
  useLogin: () => ({
    mutateAsync: mocks.mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
  useForgotPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetPassword: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}))

import LoginPage from "./LoginPage"

const buyNowPending = () => ({
  mode: "buy_now",
  items: [
    {
      variation_id: 42,
      quantity: 1,
      product: {
        product_name: "Laptop Pro",
        thumbnail_url: "/thumb.png",
        discount_percentage: 10,
        variation: { price: 25_000_000 },
      },
    },
  ],
  redirectAfterLogin: true,
  timestamp: Date.now(),
})

const submitLogin = async () => {
  fireEvent.change(document.querySelector('input[name="username"]'), {
    target: { value: "buyer" },
  })
  fireEvent.change(document.querySelector('input[name="password"]'), {
    target: { value: "secret123" },
  })
  fireEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }))
  await waitFor(() => expect(mocks.mockMutateAsync).toHaveBeenCalled())
}

describe("LoginPage — pendingCheckout restore after login", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.mockMutateAsync.mockReset()
    mocks.mockMutateAsync.mockResolvedValue({})
    mocks.searchParams = new URLSearchParams()
    localStorage.clear()
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // FR: §6.1 / AC — restore checkout with full state
  it("navigates to checkout with pending state after successful login (§6.1)", async () => {
    const pending = buyNowPending()
    localStorage.setItem("pendingCheckout", JSON.stringify(pending))

    render(<LoginPage />)
    await submitLogin()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/checkout", {
        state: pending,
      })
    })
  })

  // FR: §6.1 — pending wins over redirect query
  it("prefers pendingCheckout over redirect query param (§6.1)", async () => {
    mocks.searchParams = new URLSearchParams("redirect=/cart")
    const pending = buyNowPending()
    localStorage.setItem("pendingCheckout", JSON.stringify(pending))

    render(<LoginPage />)
    await submitLogin()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/checkout", {
        state: pending,
      })
    })
    expect(mocks.mockNavigate).not.toHaveBeenCalledWith("/cart")
  })

  // FR: §6.1 — one-shot removeItem
  it("removes pendingCheckout from localStorage after restore (§6.1)", async () => {
    localStorage.setItem("pendingCheckout", JSON.stringify(buyNowPending()))

    render(<LoginPage />)
    await submitLogin()

    await waitFor(() => {
      expect(localStorage.getItem("pendingCheckout")).toBeNull()
    })
  })

  // FR: §6.3 — invalid JSON → redirect fallback
  it("falls back to redirect when pendingCheckout JSON is invalid (§6.3)", async () => {
    mocks.searchParams = new URLSearchParams("redirect=/cart")
    localStorage.setItem("pendingCheckout", "{not-json")

    render(<LoginPage />)
    await submitLogin()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/cart")
    })
    expect(mocks.mockNavigate).not.toHaveBeenCalledWith(
      "/checkout",
      expect.anything()
    )
    expect(localStorage.getItem("pendingCheckout")).toBe("{not-json")
  })

  // FR: §6.3 — no pending uses redirect
  it("navigates to redirect query when no pendingCheckout (§6.3)", async () => {
    mocks.searchParams = new URLSearchParams("redirect=/checkout")

    render(<LoginPage />)
    await submitLogin()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/checkout")
    })
    expect(mocks.mockNavigate).not.toHaveBeenCalledWith(
      "/checkout",
      expect.objectContaining({ state: expect.anything() })
    )
  })

  // FR: §6.3 — default home
  it('navigates to "/" when no pending and no redirect (§6.3)', async () => {
    render(<LoginPage />)
    await submitLogin()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/")
    })
  })

  // FR: negative — login failure
  it("does not restore checkout when login fails", async () => {
    mocks.mockMutateAsync.mockRejectedValue(new Error("Invalid credentials"))
    localStorage.setItem("pendingCheckout", JSON.stringify(buyNowPending()))

    render(<LoginPage />)
    await submitLogin()

    await waitFor(() => expect(mocks.mockMutateAsync).toHaveBeenCalled())
    expect(mocks.mockNavigate).not.toHaveBeenCalled()
    expect(localStorage.getItem("pendingCheckout")).not.toBeNull()
  })
})
