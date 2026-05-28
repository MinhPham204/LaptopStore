import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAddMutate: vi.fn(),
  mockDispatch: vi.fn(),
  isAuthenticated: true,
  useProductReturn: {
    data: null,
    isLoading: false,
    error: null,
  },
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mocks.mockNavigate,
    useParams: () => ({ id: "1" }),
  }
})

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.mockDispatch,
  useSelector: (selector) =>
    selector({
      auth: { isAuthenticated: mocks.isAuthenticated, user: null },
      compare: { items: [] },
    }),
}))

vi.mock("../hooks/useProducts", () => ({
  useProduct: () => mocks.useProductReturn,
  useRecommendedByVariation: () => ({ data: null }),
}))

vi.mock("../hooks/useCart", () => ({
  useAddToCart: () => ({ mutate: mocks.mockAddMutate, isPending: false }),
}))

vi.mock("../components/CompareBar", () => ({ default: () => null }))
vi.mock("../components/CompareModal", () => ({ default: () => null }))
vi.mock("../components/ProductCard", () => ({ default: () => null }))
vi.mock("../components/ProductRecommendations", () => ({ default: () => null }))
vi.mock("../components/SpecsModal", () => ({ default: () => null }))
vi.mock("../components/SpecsTable", () => ({ default: () => null }))

import ProductDetailPage from "./ProductDetailPage"

const baseVariation = (overrides = {}) => ({
  variation_id: 501,
  is_primary: true,
  processor: "Intel i7",
  ram: "16GB",
  storage: "512GB SSD",
  graphics_card: "RTX 4060",
  screen_size: '15.6"',
  color: "Gray",
  stock_quantity: 10,
  is_available: true,
  price: 25_000_000,
  ...overrides,
})

const buildProduct = (variationOverrides = {}, productOverrides = {}) => ({
  product: {
    product_id: 1,
    product_name: "Laptop Pro X",
    thumbnail_url: "/uploads/thumb.png",
    discount_percentage: 10,
    is_active: true,
    base_price: 25_000_000,
    variations: [baseVariation(variationOverrides)],
    images: [],
    questions: [],
    specs: {},
    ...productOverrides,
  },
})

const renderPdp = () =>
  render(
    <MemoryRouter>
      <ProductDetailPage />
    </MemoryRouter>
  )

const getBuyNowButton = () =>
  screen.getByRole("button", { name: /mua ngay/i })

const clickBuyNow = () => fireEvent.click(getBuyNowButton())

describe("ProductDetailPage — handleBuyNow", () => {
  let alertSpy

  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.mockAddMutate.mockClear()
    mocks.mockDispatch.mockClear()
    mocks.isAuthenticated = true
    localStorage.clear()
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    mocks.useProductReturn = {
      data: buildProduct(),
      isLoading: false,
      error: null,
    }
  })

  afterEach(() => {
    alertSpy.mockRestore()
    cleanup()
  })

  // FR: AC1 / BR-01 — authenticated buy now → checkout state
  it("navigates to checkout with buy_now state when authenticated (AC1, BR-01)", async () => {
    localStorage.setItem("token", "test-token")
    mocks.isAuthenticated = true
    renderPdp()

    clickBuyNow()

    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
    expect(mocks.mockNavigate).toHaveBeenCalledWith("/checkout", {
      state: {
        mode: "buy_now",
        items: [
          expect.objectContaining({
            variation_id: 501,
            quantity: 1,
            product: expect.objectContaining({
              product_name: "Laptop Pro X",
              thumbnail_url: "/uploads/thumb.png",
              discount_percentage: 10,
              variation: { price: 25_000_000 },
            }),
          }),
        ],
      },
    })
  })

  // FR: AC2 / BR-04 — guest pendingCheckout + login redirect
  it("saves pendingCheckout and redirects guest to login (AC2, BR-04)", () => {
    mocks.isAuthenticated = false
    localStorage.removeItem("token")
    renderPdp()

    clickBuyNow()

    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
    const stored = JSON.parse(localStorage.getItem("pendingCheckout"))
    expect(stored.mode).toBe("buy_now")
    expect(stored.redirectAfterLogin).toBe(true)
    expect(typeof stored.timestamp).toBe("number")
    expect(stored.items).toEqual([
      expect.objectContaining({
        variation_id: 501,
        quantity: 1,
        product: expect.objectContaining({
          product_name: "Laptop Pro X",
        }),
      }),
    ])
    expect(mocks.mockNavigate).toHaveBeenCalledWith("/login?redirect=/checkout")
  })

  // FR: BR-01 — buy now does not call addToCart API
  it("does not call addToCart.mutate on buy now (BR-01)", () => {
    renderPdp()
    clickBuyNow()
    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
  })

  // FR: AC1 — quantity respected in checkout intent
  it("uses selected quantity in checkout intent (AC1)", () => {
    renderPdp()
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "3" },
    })
    clickBuyNow()

    const call = mocks.mockNavigate.mock.calls.find((c) => c[0] === "/checkout")
    expect(call[1].state.items[0].quantity).toBe(3)
  })

  // FR: PRE-03 / AC — out of stock blocks buy now
  it("does not navigate when variation is out of stock (PRE-03)", () => {
    mocks.useProductReturn = {
      data: buildProduct({ stock_quantity: 0, is_available: false }),
      isLoading: false,
      error: null,
    }
    renderPdp()

    expect(getBuyNowButton()).toBeDisabled()
    clickBuyNow()
    expect(mocks.mockNavigate).not.toHaveBeenCalled()
    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
  })

  // FR: PRE-03 — quantity exceeds stock
  it("does not navigate when quantity exceeds stock (PRE-03)", () => {
    renderPdp()
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "99" },
    })

    expect(getBuyNowButton()).toBeDisabled()
    clickBuyNow()
    expect(mocks.mockNavigate).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — configuration reset → not ready
  it("does not navigate after reset when configuration is incomplete (PRE-01)", () => {
    renderPdp()
    fireEvent.click(screen.getByRole("button", { name: /thiết lập lại/i }))

    expect(getBuyNowButton()).toBeDisabled()
    clickBuyNow()
    expect(mocks.mockNavigate).not.toHaveBeenCalled()
    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
  })

  // FR: PRE-02 — inactive product
  it("does not navigate when product is inactive (PRE-02)", () => {
    mocks.useProductReturn = {
      data: buildProduct({}, { is_active: false }),
      isLoading: false,
      error: null,
    }
    renderPdp()

    expect(getBuyNowButton()).toBeDisabled()
    clickBuyNow()
    expect(mocks.mockNavigate).not.toHaveBeenCalled()
  })
})
