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
  default: () => <div data-testid="payment-options" />,
}))

vi.mock("../components/MapPicker", () => ({
  default: ({ onChange, onConfirm }) => (
    <div data-testid="map-picker-mock">
      <button
        type="button"
        data-testid="map-picker-change"
        onClick={() => onChange?.({ lat: 10.77, lng: 106.71 })}
      >
        Di chuyển marker
      </button>
      <button
        type="button"
        data-testid="map-picker-confirm"
        onClick={() => onConfirm?.({ lat: 10.776889, lng: 106.700806 })}
      >
        Xác nhận vị trí
      </button>
    </div>
  ),
}))

import CheckoutPage from "./CheckoutPage"

const cartIntentState = {
  mode: "cart",
  items: [{ variation_id: 101, quantity: 1 }],
}

const renderCheckout = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/checkout", state: cartIntentState }]}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>
  )

const fillShippingFields = async (container) => {
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
}

describe("CheckoutPage — map address confirmation", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.mockDispatch.mockClear()
    mocks.mockMutateAsync.mockReset()
    mocks.mockMutateAsync.mockResolvedValue({
      order: { order_code: "ORD-MAP-1" },
    })
    mocks.cartItems = [
      {
        id: 1,
        variation_id: 101,
        quantity: 1,
        product: { product_name: "Alpha", variation: { price: 10_000_000 } },
      },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => [{ lat: "10.776", lon: "106.7" }],
    })
  })

  afterEach(() => {
    cleanup()
  })

  // FR: §5 / AC — confirm enables submit + geo in payload
  it("enables submit and sends geo_lat/geo_lng after map confirm (§5, AC)", async () => {
    const { container } = renderCheckout()
    await screen.findByText("Giỏ hàng")
    await fillShippingFields(container)

    const submitBtn = screen.getByRole("button", { name: /đặt hàng/i })
    expect(submitBtn).toBeDisabled()

    fireEvent.click(screen.getByTestId("map-picker-confirm"))

    await waitFor(() => expect(submitBtn).not.toBeDisabled())

    fireEvent.click(submitBtn)

    await waitFor(() => expect(mocks.mockMutateAsync).toHaveBeenCalled())

    expect(mocks.mockMutateAsync.mock.calls[0][0]).toMatchObject({
      geo_lat: 10.776889,
      geo_lng: 106.700806,
    })
  })

  // FR: §5 / AC — success banner after confirm
  it("shows success banner with coordinates after map confirm (§5)", async () => {
    const { container } = renderCheckout()
    await fillShippingFields(container)

    fireEvent.click(screen.getByTestId("map-picker-confirm"))

    await waitFor(() => {
      expect(screen.getByText(/đã xác nhận vị trí/i)).toBeInTheDocument()
      expect(screen.getByText(/10\.776889/)).toBeInTheDocument()
    })
  })

  // FR: §5 — negative no confirm
  it("keeps submit disabled when map is not confirmed (§5)", async () => {
    const { container } = renderCheckout()
    await fillShippingFields(container)

    const submitBtn = screen.getByRole("button", { name: /đặt hàng/i })
    expect(submitBtn).toBeDisabled()

    fireEvent.click(submitBtn)

    expect(mocks.mockMutateAsync).not.toHaveBeenCalled()
  })

  // FR: §7 — onChange resets confirmation
  it("disables submit again after marker onChange following confirm (§7)", async () => {
    const { container } = renderCheckout()
    await fillShippingFields(container)

    const submitBtn = screen.getByRole("button", { name: /đặt hàng/i })

    fireEvent.click(screen.getByTestId("map-picker-confirm"))
    await waitFor(() => expect(submitBtn).not.toBeDisabled())

    fireEvent.click(screen.getByTestId("map-picker-change"))

    await waitFor(() => expect(submitBtn).toBeDisabled())
    expect(mocks.mockMutateAsync).not.toHaveBeenCalled()
  })
})
