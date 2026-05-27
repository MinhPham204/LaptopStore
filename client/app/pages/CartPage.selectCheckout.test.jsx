import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { formatPrice } from "../utils/formatters"

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockDispatch: vi.fn(),
  cartItems: [],
  isAuthenticated: true,
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mocks.mockNavigate,
  }
})

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.mockDispatch,
  useSelector: (selector) =>
    selector({
      cart: { items: mocks.cartItems },
      auth: { isAuthenticated: mocks.isAuthenticated },
    }),
}))

vi.mock("../hooks/useCart", () => ({
  useGetCart: () => ({ data: null }),
  useAddToCart: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCartItem: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveFromCart: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("../services/api", () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
  },
}))

import CartPage from "./CartPage"

const buildCartItem = ({
  cart_item_id,
  variation_id,
  quantity = 1,
  price,
  product_name = "Laptop",
  stock_quantity = 10,
  is_available = true,
}) => ({
  cart_item_id,
  variation_id,
  quantity,
  price,
  unit_price_after_discount: price,
  product: {
    product_id: 1,
    product_name,
    thumbnail_url: "/uploads/thumb.png",
  },
  variation: {
    stock_quantity,
    is_available,
    processor: "i7",
    ram: "16GB",
    storage: "512GB",
  },
})

const itemA = buildCartItem({
  cart_item_id: 1,
  variation_id: 101,
  quantity: 2,
  price: 10_000_000,
  product_name: "Laptop Alpha",
})

const itemB = buildCartItem({
  cart_item_id: 2,
  variation_id: 102,
  quantity: 1,
  price: 5_000_000,
  product_name: "Laptop Beta",
})

const renderCartPage = () =>
  render(
    <MemoryRouter>
      <CartPage />
    </MemoryRouter>
  )

const normalizeMoneyText = (text) => String(text).replace(/\u00a0/g, " ")

const getOrderSummaryPanel = () =>
  screen.getByRole("heading", { name: "Tổng đơn hàng" }).closest(".sticky")

const getCheckboxes = () => screen.getAllByRole("checkbox")

const getSelectAllCheckbox = () => screen.getByLabelText(/chọn tất cả/i)

const getSubtotalEl = () => {
  const panel = getOrderSummaryPanel()
  const row = within(panel).getByText("Tổng tiền").closest("div")
  return within(row).getByText((_, el) => el.classList.contains("text-blue-600"))
}

const clickCheckout = () => {
  const panel = getOrderSummaryPanel()
  fireEvent.click(within(panel).getByRole("button", { name: "Thanh toán" }))
}

describe("CartPage — select items for checkout", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.mockDispatch.mockClear()
    mocks.isAuthenticated = true
    mocks.cartItems = [itemA, itemB]
  })

  afterEach(() => {
    cleanup()
  })

  // FR: AC1 — subtotal chỉ tính item còn tick
  it("computes subtotal only for checked items when one item is unchecked", () => {
    renderCartPage()

    expect(normalizeMoneyText(getSubtotalEl().textContent)).toBe(
      normalizeMoneyText(formatPrice(10_000_000 * 2 + 5_000_000))
    )

    const boxes = getCheckboxes()
    fireEvent.click(boxes[2])

    expect(normalizeMoneyText(getSubtotalEl().textContent)).toBe(
      normalizeMoneyText(formatPrice(10_000_000 * 2))
    )
    const orderPanel = getOrderSummaryPanel()
    expect(within(orderPanel).queryByText("Laptop Beta")).not.toBeInTheDocument()
    expect(within(orderPanel).getByText("Laptop Alpha")).toBeInTheDocument()
  })

  // FR: AC2 — Chọn tất cả: toggle off rồi on
  it("toggles select-all off then on with correct isAllSelected state", () => {
    renderCartPage()

    const selectAll = getSelectAllCheckbox()
    expect(selectAll).toBeChecked()
    expect(screen.getByText("Chọn tất cả (2/2)")).toBeInTheDocument()

    fireEvent.click(selectAll)
    expect(selectAll).not.toBeChecked()
    expect(screen.getByText("Chọn tất cả (0/2)")).toBeInTheDocument()

    fireEvent.click(selectAll)
    expect(selectAll).toBeChecked()
    expect(screen.getByText("Chọn tất cả (2/2)")).toBeInTheDocument()
    getCheckboxes().slice(1).forEach((box) => expect(box).toBeChecked())
  })

  // FR: AC3 — item tick hết hàng → Thanh toán disabled
  it("disables checkout when a selected item is out of stock", () => {
    mocks.cartItems = [
      buildCartItem({
        cart_item_id: 1,
        variation_id: 201,
        quantity: 1,
        price: 8_000_000,
        stock_quantity: 0,
        is_available: false,
      }),
    ]
    renderCartPage()

    const checkoutBtn = within(getOrderSummaryPanel()).getByRole("button", {
      name: "Thanh toán",
    })
    expect(checkoutBtn).toBeDisabled()
    expect(
      screen.getByText(/Một hoặc nhiều sản phẩm bạn chọn không thể đặt hàng/i)
    ).toBeInTheDocument()
  })

  // FR: AC4 — đã login → navigate checkout với subset đã tick
  it("navigates to checkout with only selected items when authenticated", () => {
    renderCartPage()

    const boxes = getCheckboxes()
    fireEvent.click(boxes[2])

    clickCheckout()

    expect(mocks.mockNavigate).toHaveBeenCalledWith("/checkout", {
      state: {
        mode: "cart",
        items: [{ variation_id: 101, quantity: 2 }],
      },
    })
  })

  // FR: BR-01 — không chọn item → không navigate
  it("does not navigate when no items are selected", () => {
    renderCartPage()

    fireEvent.click(getSelectAllCheckbox())
    expect(screen.getByText("Chọn tất cả (0/2)")).toBeInTheDocument()

    const checkoutBtn = within(getOrderSummaryPanel()).getByRole("button", {
      name: "Thanh toán",
    })
    expect(checkoutBtn).toBeDisabled()

    clickCheckout()
    expect(mocks.mockNavigate).not.toHaveBeenCalled()
  })

  // FR: BR-05 / guest — chưa login → login redirect
  it("navigates guest to login with checkout redirect", () => {
    mocks.isAuthenticated = false
    renderCartPage()

    clickCheckout()

    expect(mocks.mockNavigate).toHaveBeenCalledWith("/login?redirect=/checkout")
    expect(mocks.mockNavigate).not.toHaveBeenCalledWith(
      "/checkout",
      expect.anything()
    )
  })

  // FR: BR-03 — items đổi → effect chọn lại tất cả
  it("re-selects all items when cart items change from the store", () => {
    const { rerender } = renderCartPage()

    fireEvent.click(getCheckboxes()[1])
    expect(getCheckboxes()[1]).not.toBeChecked()

    mocks.cartItems = [
      buildCartItem({
        cart_item_id: 10,
        variation_id: 1001,
        quantity: 1,
        price: 3_000_000,
        product_name: "Laptop Gamma",
      }),
      buildCartItem({
        cart_item_id: 11,
        variation_id: 1002,
        quantity: 2,
        price: 4_000_000,
        product_name: "Laptop Delta",
      }),
    ]

    rerender(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    )

    const boxes = getCheckboxes()
    expect(screen.getByText("Chọn tất cả (2/2)")).toBeInTheDocument()
    expect(boxes[0]).toBeChecked()
    expect(boxes[1]).toBeChecked()
    expect(boxes[2]).toBeChecked()
    expect(screen.getAllByText("Laptop Gamma").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Laptop Delta").length).toBeGreaterThan(0)
  })
})
