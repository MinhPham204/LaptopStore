import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockDispatch: vi.fn(),
  mockMutateAsync: vi.fn(),
  cartItems: [],
  previewData: {
    subtotal_after_discount: 20_000_000,
    shipping_fee: 30_000,
    final_amount: 20_030_000,
  },
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
      auth: {
        user: {
          full_name: "Nguyen Van A",
          email: "buyer@example.com",
          phone_number: "0901234567",
        },
      },
    }),
}))

vi.mock("../hooks/useOrders", () => ({
  useCreateOrder: () => ({
    mutateAsync: mocks.mockMutateAsync,
    isPending: false,
  }),
}))

vi.mock("../hooks/useProvinces", () => ({
  useProvinces: () => ({
    data: [{ province_id: 1, name: "TP HCM" }],
  }),
}))

vi.mock("../hooks/useWards", () => ({
  useWards: () => ({
    data: [{ ward_id: 2, name: "Phuong 1" }],
  }),
}))

vi.mock("../hooks/useOrderPreview", () => ({
  useOrderPreview: () => ({
    data: mocks.previewData,
    loading: false,
    error: null,
  }),
}))

vi.mock("../components/PaymentOptions", () => ({
  default: ({ onChange }) => (
    <div data-testid="payment-options">
      <button
        type="button"
        onClick={() =>
          onChange({ payment_provider: "COD", payment_method: "COD" })
        }
      >
        Chọn COD
      </button>
      <button
        type="button"
        onClick={() =>
          onChange({ payment_provider: "VNPAY", payment_method: "VNPAYQR" })
        }
      >
        Chọn VNPAY
      </button>
    </div>
  ),
}))

vi.mock("../components/MapPicker", () => ({
  default: ({ onConfirm }) => (
    <button
      type="button"
      onClick={() => onConfirm?.({ lat: 10.776, lng: 106.7 })}
    >
      Xác nhận vị trí
    </button>
  ),
}))

import CheckoutPage from "./CheckoutPage"

const cartIntentState = {
  mode: "cart",
  items: [
    { variation_id: 101, quantity: 2 },
    { variation_id: 102, quantity: 1 },
  ],
}

const buyNowIntentState = {
  mode: "buy_now",
  items: [
    {
      variation_id: 501,
      quantity: 2,
      product: {
        product_name: "Laptop Pro X",
        thumbnail_url: "/thumb.png",
        discount_percentage: 10,
        variation: { price: 25_000_000 },
      },
    },
  ],
}

const renderCheckout = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/checkout", state }]}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>
  )

const fillAddressAndConfirmMap = async (container) => {
  fireEvent.change(container.querySelector('select[name="city"]'), {
    target: { value: "1" },
  })
  fireEvent.change(container.querySelector('select[name="ward"]'), {
    target: { value: "2" },
  })
  await waitFor(() => {
    expect(screen.getByPlaceholderText(/số nhà/i)).not.toBeDisabled()
  })
  fireEvent.change(screen.getByPlaceholderText(/số nhà/i), {
    target: { value: "109 Test Street" },
  })
  fireEvent.click(screen.getByRole("button", { name: /xác nhận vị trí/i }))
  const submitBtn = screen.getByRole("button", { name: /đặt hàng/i })
  await waitFor(() => expect(submitBtn).not.toBeDisabled())
  return submitBtn
}

describe("CheckoutPage — checkout flow", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.mockDispatch.mockClear()
    mocks.mockMutateAsync.mockReset()
    mocks.mockMutateAsync.mockResolvedValue({
      order: { order_code: "ORD-FLOW-1" },
    })
    mocks.cartItems = [
      {
        id: 1,
        variation_id: 101,
        quantity: 2,
        product: { product_name: "Alpha", variation: { price: 10_000_000 } },
      },
      {
        id: 2,
        variation_id: 102,
        quantity: 1,
        product: { product_name: "Beta", variation: { price: 5_000_000 } },
      },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => [{ lat: "10.776", lon: "106.7" }],
    })
    vi.stubGlobal("location", { href: "" })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  // FR: §4 — guard intent rỗng
  it("redirects to /cart when checkout intent is missing (§4)", async () => {
    renderCheckout(null)

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/cart", { replace: true })
    })
  })

  it("redirects to /cart when intent items array is empty (§4)", async () => {
    renderCheckout({ mode: "cart", items: [] })

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/cart", { replace: true })
    })
  })

  // FR: §9 — COD cart → success + removeMany
  it("navigates to success and dispatches removeMany for COD cart checkout (§9)", async () => {
    const { container } = renderCheckout(cartIntentState)
    await screen.findByText("Giỏ hàng")

    const submitBtn = await fillAddressAndConfirmMap(container)
    fireEvent.click(submitBtn)

    await waitFor(() => expect(mocks.mockMutateAsync).toHaveBeenCalled())

    const orderPayload = mocks.mockMutateAsync.mock.calls[0][0]
    expect(orderPayload.items).toEqual([
      { variation_id: 101, quantity: 2 },
      { variation_id: 102, quantity: 1 },
    ])
    expect(orderPayload.payment_provider).toBe("COD")

    const dispatchedRemoveMany = mocks.mockDispatch.mock.calls.some(([action]) =>
      String(action?.type || "").includes("removeMany")
    )
    expect(dispatchedRemoveMany).toBe(true)

    expect(mocks.mockNavigate).toHaveBeenCalledWith(
      "/checkout/success",
      expect.objectContaining({
        replace: true,
        state: expect.objectContaining({
          order_code: "ORD-FLOW-1",
          customer_name: "Nguyen Van A",
        }),
      })
    )
  })

  // FR: §9 — buy_now COD không removeMany
  it("does not dispatch removeMany for buy_now COD checkout (§9)", async () => {
    const { container } = renderCheckout(buyNowIntentState)
    await screen.findByText("Mua ngay")

    const submitBtn = await fillAddressAndConfirmMap(container)
    fireEvent.click(submitBtn)

    await waitFor(() => expect(mocks.mockMutateAsync).toHaveBeenCalled())

    expect(mocks.mockMutateAsync.mock.calls[0][0].items).toEqual([
      { variation_id: 501, quantity: 2 },
    ])

    const dispatchedRemoveMany = mocks.mockDispatch.mock.calls.some(([action]) =>
      String(action?.type || "").includes("removeMany")
    )
    expect(dispatchedRemoveMany).toBe(false)
    expect(mocks.mockNavigate).toHaveBeenCalledWith(
      "/checkout/success",
      expect.objectContaining({ replace: true })
    )
  })

  // FR: §9 — VNPAY redirect
  it("assigns window.location.href when createOrder returns redirect (§9)", async () => {
    mocks.mockMutateAsync.mockResolvedValue({
      redirect: "https://sandbox.vnpayment.vn/pay?token=abc",
    })

    const { container } = renderCheckout(cartIntentState)
    fireEvent.click(screen.getByRole("button", { name: /chọn vnpay/i }))

    const submitBtn = await fillAddressAndConfirmMap(container)
    fireEvent.click(submitBtn)

    await waitFor(() => expect(mocks.mockMutateAsync).toHaveBeenCalled())

    expect(mocks.mockMutateAsync.mock.calls[0][0].payment_provider).toBe("VNPAY")
    expect(window.location.href).toBe(
      "https://sandbox.vnpayment.vn/pay?token=abc"
    )
    expect(mocks.mockNavigate).not.toHaveBeenCalledWith(
      "/checkout/success",
      expect.anything()
    )
  })

  // FR: §6 — submit disabled until map confirmed
  it("keeps submit disabled until location is confirmed (§6)", async () => {
    const { container } = renderCheckout(cartIntentState)

    fireEvent.change(container.querySelector('select[name="city"]'), {
      target: { value: "1" },
    })
    fireEvent.change(container.querySelector('select[name="ward"]'), {
      target: { value: "2" },
    })
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/số nhà/i)).not.toBeDisabled()
    })
    fireEvent.change(screen.getByPlaceholderText(/số nhà/i), {
      target: { value: "109 Test Street" },
    })

    expect(screen.getByRole("button", { name: /đặt hàng/i })).toBeDisabled()
    expect(mocks.mockMutateAsync).not.toHaveBeenCalled()
  })

  // FR: GAP-03 — create fail không navigate success
  it("does not navigate to success when createOrder fails (GAP-03)", async () => {
    mocks.mockMutateAsync.mockRejectedValue(new Error("CREATE_FAILED"))
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const { container } = renderCheckout(cartIntentState)
    const submitBtn = await fillAddressAndConfirmMap(container)
    fireEvent.click(submitBtn)

    await waitFor(() => expect(mocks.mockMutateAsync).toHaveBeenCalled())

    expect(mocks.mockNavigate).not.toHaveBeenCalledWith(
      "/checkout/success",
      expect.anything()
    )
    consoleSpy.mockRestore()
  })
})
