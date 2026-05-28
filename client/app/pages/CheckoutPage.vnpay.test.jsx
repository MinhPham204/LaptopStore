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

const VNPAY_REDIRECT = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=1"

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

const renderCheckout = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/checkout", state: cartIntentState }]}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>
  )

const fillAddressAndSubmit = async (container) => {
  fireEvent.click(screen.getByRole("button", { name: /chọn vnpay/i }))

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
  fireEvent.click(submitBtn)
}

describe("CheckoutPage — VNPAY redirect (FR_VNPayPaymentInCreateOrder)", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.mockDispatch.mockClear()
    mocks.mockMutateAsync.mockReset()
    mocks.mockMutateAsync.mockResolvedValue({
      redirect: VNPAY_REDIRECT,
      order: {
        order_id: 1,
        order_code: "ORD-VNP-1",
        status: "AWAITING_PAYMENT",
      },
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

  // FR: §7 BR-01 — redirect full page, không /checkout/success
  it("sets window.location.href to redirect when createOrder returns redirect (§7)", async () => {
    const { container } = renderCheckout()
    await screen.findByText("Giỏ hàng")

    await fillAddressAndSubmit(container)

    await waitFor(() => expect(mocks.mockMutateAsync).toHaveBeenCalled())

    expect(mocks.mockMutateAsync.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        payment_provider: "VNPAY",
        payment_method: "VNPAYQR",
      })
    )
    expect(window.location.href).toBe(VNPAY_REDIRECT)
    expect(mocks.mockNavigate).not.toHaveBeenCalledWith(
      "/checkout/success",
      expect.anything()
    )
  })

  // FR: §7 BR-03 — Redux cart không removeMany sau VNPAY
  it("does not dispatch removeMany after VNPAY redirect (BR-03)", async () => {
    const { container } = renderCheckout()
    await screen.findByText("Giỏ hàng")

    await fillAddressAndSubmit(container)

    await waitFor(() =>
      expect(window.location.href).toBe(VNPAY_REDIRECT)
    )

    const dispatchedRemoveMany = mocks.mockDispatch.mock.calls.some(([action]) =>
      String(action?.type || "").includes("removeMany")
    )
    expect(dispatchedRemoveMany).toBe(false)
  })
})
