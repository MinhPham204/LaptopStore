import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockDispatch: vi.fn(),
  mockAddMutate: vi.fn(),
  mockRemoveMutate: vi.fn(),
  mockApiGet: vi.fn(),
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
  useAddToCart: () => ({ mutate: mocks.mockAddMutate, isPending: false }),
  useUpdateCartItem: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveFromCart: () => ({ mutate: mocks.mockRemoveMutate, isPending: false }),
}))

vi.mock("../services/api", () => ({
  default: {
    get: (...args) => mocks.mockApiGet(...args),
    delete: vi.fn(),
  },
}))

import CartPage from "./CartPage"

const PRODUCT_VARIATIONS = [
  {
    variation_id: 101,
    ram: "16GB",
    storage: "512GB",
    color: "Gray",
    stock_quantity: 5,
    is_available: true,
    price: 10_000_000,
  },
  {
    variation_id: 102,
    ram: "32GB",
    storage: "1TB",
    color: "Black",
    stock_quantity: 3,
    is_available: true,
    price: 12_000_000,
  },
  {
    variation_id: 103,
    ram: "8GB",
    storage: "256GB",
    color: "Silver",
    stock_quantity: 0,
    is_available: false,
    price: 8_000_000,
  },
]

const cartLineItem = {
  cart_item_id: 10,
  variation_id: 101,
  quantity: 2,
  price: 10_000_000,
  product: {
    product_id: 1,
    product_name: "Laptop Pro",
    thumbnail_url: "/uploads/thumb.png",
  },
  variation: {
    stock_quantity: 5,
    is_available: true,
    processor: "i7",
    ram: "16GB",
    storage: "512GB",
    color: "Gray",
  },
}

const mockProductDetail = () => {
  mocks.mockApiGet.mockResolvedValue({
    data: {
      product: {
        product_id: 1,
        product_name: "Laptop Pro",
        variations: PRODUCT_VARIATIONS,
      },
    },
  })
}

const renderCartPage = () =>
  render(
    <MemoryRouter>
      <CartPage />
    </MemoryRouter>
  )

const openVariationModal = async () => {
  fireEvent.click(screen.getByRole("button", { name: /đổi cấu hình/i }))
  await waitFor(() => expect(mocks.mockApiGet).toHaveBeenCalledWith("/products/1"))
  await waitFor(() => expect(screen.getByText("RAM")).toBeInTheDocument())
}

const getVariantSelects = () => screen.getAllByRole("combobox")

const setVariantSelection = ({ ram, storage, color }) => {
  const selects = getVariantSelects()
  if (ram != null) fireEvent.change(selects[0], { target: { value: ram } })
  if (storage != null) fireEvent.change(selects[1], { target: { value: storage } })
  if (color != null) fireEvent.change(selects[2], { target: { value: color } })
}

const clickApply = () => {
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }))
}

describe("CartPage — change cart item variation", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.mockDispatch.mockClear()
    mocks.mockAddMutate.mockReset()
    mocks.mockRemoveMutate.mockReset()
    mocks.mockApiGet.mockReset()
    mocks.cartItems = [cartLineItem]
    mockProductDetail()
  })

  afterEach(() => {
    cleanup()
  })

  // FR: BR-04 / AC4 — cùng variation_id → đóng modal, không POST/DELETE
  it("closes modal without calling add or remove when variation is unchanged", async () => {
    renderCartPage()
    await openVariationModal()
    clickApply()

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Áp dụng" })).not.toBeInTheDocument()
    })
    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
    expect(mocks.mockRemoveMutate).not.toHaveBeenCalled()
  })

  // FR: AC3 — SKU hết hàng → lỗi, không POST
  it("shows out-of-stock error and does not add when chosen variation is unavailable", async () => {
    renderCartPage()
    await openVariationModal()
    setVariantSelection({ ram: "8GB", storage: "256GB", color: "Silver" })
    clickApply()

    expect(await screen.findByText("Cấu hình này đã hết hàng.")).toBeInTheDocument()
    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
    expect(mocks.mockRemoveMutate).not.toHaveBeenCalled()
  })

  // FR: AC3 — không match cấu hình → lỗi, không POST
  it("shows match error and does not add when no variation matches selection", async () => {
    renderCartPage()
    await openVariationModal()
    setVariantSelection({ ram: "16GB", storage: "1TB", color: "Black" })
    clickApply()

    expect(
      await screen.findByText("Không tìm thấy cấu hình phù hợp. Hãy chọn lại.")
    ).toBeInTheDocument()
    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
    expect(mocks.mockRemoveMutate).not.toHaveBeenCalled()
  })

  // FR: AC1 / AC2 / BR-01 — SKU khác: POST qty giữ nguyên → DELETE dòng cũ
  it("adds new variation then removes old cart line with same quantity", async () => {
    mocks.mockAddMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.()
    })
    mocks.mockRemoveMutate.mockImplementation((_id, options) => {
      options?.onSuccess?.()
    })

    renderCartPage()
    await openVariationModal()
    setVariantSelection({ ram: "32GB", storage: "1TB", color: "Black" })
    clickApply()

    await waitFor(() => {
      expect(mocks.mockAddMutate).toHaveBeenCalledWith(
        { variation_id: 102, quantity: 2 },
        expect.objectContaining({ onSuccess: expect.any(Function) })
      )
    })
    expect(mocks.mockRemoveMutate).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Áp dụng" })).not.toBeInTheDocument()
    })
  })

  // FR: BR-02 — add fail → remove không gọi
  it("does not remove old item when addToCart fails", async () => {
    mocks.mockAddMutate.mockImplementation((_payload, options) => {
      options?.onError?.()
    })

    renderCartPage()
    await openVariationModal()
    setVariantSelection({ ram: "32GB", storage: "1TB", color: "Black" })
    clickApply()

    await waitFor(() => {
      expect(
        screen.getByText("Không đổi được cấu hình. Vui lòng thử lại.")
      ).toBeInTheDocument()
    })
    expect(mocks.mockRemoveMutate).not.toHaveBeenCalled()
  })

  // FR: AC4 — Hủy modal → không mutate
  it("does not call add or remove when user cancels the modal", async () => {
    renderCartPage()
    await openVariationModal()
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }))

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Áp dụng" })).not.toBeInTheDocument()
    })
    expect(mocks.mockAddMutate).not.toHaveBeenCalled()
    expect(mocks.mockRemoveMutate).not.toHaveBeenCalled()
  })
})
