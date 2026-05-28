import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockDispatch: vi.fn(),
  mockMutateAsync: vi.fn(),
  cartItems: [],
  previewData: {
    subtotal_after_discount: 10_000_000,
    shipping_fee: 30_000,
    final_amount: 10_030_000,
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
  default: () => <div data-testid="map-picker-stub" />,
}))

import CheckoutPage from "./CheckoutPage"

const cartIntentState = {
  mode: "cart",
  items: [{ variation_id: 101, quantity: 1 }],
}

const nominatimHit = [{ lat: "10.776889", lon: "106.700806" }]

const renderCheckout = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/checkout", state: cartIntentState }]}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>
  )

const getFetchUrls = () => global.fetch.mock.calls.map((c) => String(c[0]))

describe("CheckoutPage — forward geocode on blur", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.cartItems = [
      {
        id: 1,
        variation_id: 101,
        quantity: 1,
        product: { product_name: "Alpha", variation: { price: 10_000_000 } },
      },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => nominatimHit,
    })
  })

  afterEach(() => {
    cleanup()
  })

  // FR: §10 — blur address triggers search geocode
  it("calls Nominatim search on address blur when province and ward are set (§10)", async () => {
    const { container } = renderCheckout()
    await screen.findByText("Giỏ hàng")

    fireEvent.change(container.querySelector('select[name="city"]'), {
      target: { value: "1" },
    })
    fireEvent.change(container.querySelector('select[name="ward"]'), {
      target: { value: "2" },
    })

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    const callsBeforeBlur = global.fetch.mock.calls.length

    const addressInput = screen.getByPlaceholderText(/số nhà/i)
    await waitFor(() => expect(addressInput).not.toBeDisabled())

    fireEvent.change(addressInput, { target: { value: "109 Test Street" } })
    fireEvent.blur(addressInput)

    await waitFor(() => {
      expect(global.fetch.mock.calls.length).toBeGreaterThan(callsBeforeBlur)
    })

    const urls = getFetchUrls()
    expect(urls.some((u) => u.includes("nominatim.openstreetmap.org/search"))).toBe(
      true
    )
    expect(urls.every((u) => !/\/reverse/i.test(u))).toBe(true)

    const lastUrl = urls[urls.length - 1]
    expect(lastUrl).toContain(encodeURIComponent("109 Test Street"))
    expect(lastUrl).toContain("format=json")
    expect(lastUrl).toContain("limit=1")
  })

  // FR: §6 — success banner after geocode
  it("shows success banner after geocode finds a location (§6)", async () => {
    const { container } = renderCheckout()

    fireEvent.change(container.querySelector('select[name="city"]'), {
      target: { value: "1" },
    })
    fireEvent.change(container.querySelector('select[name="ward"]'), {
      target: { value: "2" },
    })

    const addressInput = await screen.findByPlaceholderText(/số nhà/i)
    fireEvent.change(addressInput, { target: { value: "109 Test Street" } })
    fireEvent.blur(addressInput)

    await waitFor(() => {
      expect(screen.getByText(/đã tìm thấy vị trí phù hợp/i)).toBeInTheDocument()
    })
  })

  // FR: BR-02 — empty geocode result
  it("shows warning banner when Nominatim returns no results on blur (BR-02)", async () => {
    global.fetch.mockResolvedValue({ json: async () => [] })

    const { container } = renderCheckout()

    fireEvent.change(container.querySelector('select[name="city"]'), {
      target: { value: "1" },
    })
    fireEvent.change(container.querySelector('select[name="ward"]'), {
      target: { value: "2" },
    })

    const addressInput = await screen.findByPlaceholderText(/số nhà/i)
    fireEvent.change(addressInput, { target: { value: "109 Nowhere" } })
    fireEvent.blur(addressInput)

    await waitFor(() => {
      expect(
        screen.getByText(/không tìm thấy vị trí phù hợp/i)
      ).toBeInTheDocument()
    })

    expect(getFetchUrls().every((u) => !/\/reverse/i.test(u))).toBe(true)
  })
})
