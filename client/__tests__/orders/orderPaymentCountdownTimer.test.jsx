import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act, cleanup } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const BASE_MS = new Date("2026-05-28T12:00:00.000Z").getTime()

const mocks = vi.hoisted(() => ({
  ordersData: { orders: [], pagination: { page: 1, totalPages: 1, total: 0 } },
  orderDetailData: null,
  ordersLoading: false,
  orderLoading: false,
}))

vi.mock("../../app/hooks/useOrders", () => ({
  useOrders: () => ({
    data: mocks.ordersData,
    isLoading: mocks.ordersLoading,
    error: null,
    isFetching: false,
  }),
  useOrderCounters: () => ({ data: { all: 0 } }),
  useCancelOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useRetryVnpayPayment: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePaymentMethod: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateShippingAddress: () => ({ mutate: vi.fn(), isPending: false }),
  useOrder: () => ({
    data: mocks.orderDetailData,
    isLoading: mocks.orderLoading,
    error: null,
  }),
}))

vi.mock("../../app/hooks/useProvinces", () => ({
  useProvinces: () => ({ data: [] }),
}))

vi.mock("../../app/hooks/useWards", () => ({
  useWards: () => ({ data: [] }),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("../../app/components/ChangePaymentMethodDialog", () => ({
  default: () => null,
}))

vi.mock("../../app/components/EditShippingAddressDialog", () => ({
  default: () => null,
}))

import OrdersPage from "../../app/pages/OrdersPage"
import OrderDetailPage from "../../app/pages/OrderDetailPage"

const listOrder = (overrides = {}) => ({
  order_id: 1,
  order_code: "ORD-CDT-001",
  status: "AWAITING_PAYMENT",
  final_amount: 1_500_000,
  created_at: "2026-05-28T10:00:00.000Z",
  reserve_expires_at: null,
  payment: { provider: "VNPAY", payment_status: "pending" },
  items_preview: [
    {
      variation_id: 10,
      quantity: 1,
      product_name: "Laptop Test",
      thumbnail_url: null,
    },
  ],
  items_count: 1,
  ...overrides,
})

const detailOrder = (overrides = {}) => ({
  order_id: 1,
  order_code: "ORD-CDT-001",
  status: "AWAITING_PAYMENT",
  final_amount: 1_500_000,
  total_amount: 1_500_000,
  discount_amount: 0,
  shipping_fee: 30_000,
  created_at: "2026-05-28T10:00:00.000Z",
  reserve_expires_at: null,
  shipping_name: "Nguyen Van A",
  shipping_phone: "0901234567",
  shipping_address: "123 Street",
  province_id: 1,
  ward_id: 2,
  payment: {
    provider: "VNPAY",
    payment_method: "VNPAYQR",
    payment_status: "pending",
    amount: 1_500_000,
  },
  items: [
    {
      order_item_id: 1,
      variation_id: 10,
      quantity: 1,
      price: 1_500_000,
      discount_amount: 0,
      subtotal: 1_500_000,
      product: {
        product_id: 1,
        product_name: "Laptop Test",
        thumbnail_url: null,
        slug: "laptop-test",
      },
    },
  ],
  ...overrides,
})

const isoInMs = (msFromBase) =>
  new Date(BASE_MS + msFromBase).toISOString()

const renderOrdersPage = () =>
  render(
    <MemoryRouter initialEntries={["/orders?tab=all&page=1"]}>
      <Routes>
        <Route path="/orders" element={<OrdersPage />} />
      </Routes>
    </MemoryRouter>
  )

const renderOrderDetailPage = () =>
  render(
    <MemoryRouter initialEntries={["/orders/1"]}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>
  )

describe("FR_OrderPaymentCountdownTimer — OrdersPage CountdownBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_MS)
    mocks.ordersLoading = false
    mocks.ordersData = { orders: [], pagination: { page: 1, totalPages: 1, total: 0 } }
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // FR: AC §10 / BR-01 — badge Xh Ym
  it("shows CountdownBadge as Xh Ym for AWAITING_PAYMENT with reserve_expires_at (AC §10, BR-01)", () => {
    mocks.ordersData = {
      orders: [
        listOrder({
          reserve_expires_at: isoInMs(2 * 60 * 60 * 1000 + 5 * 60 * 1000),
        }),
      ],
      pagination: { page: 1, totalPages: 1, total: 1 },
    }

    renderOrdersPage()

    expect(screen.getByText("2h 5m")).toBeInTheDocument()
  })

  // FR: AC §10 / BR-02 — badge hidden when expired
  it("hides CountdownBadge when reserve_expires_at is in the past (AC §10, BR-02)", () => {
    mocks.ordersData = {
      orders: [
        listOrder({
          reserve_expires_at: isoInMs(-60 * 1000),
        }),
      ],
      pagination: { page: 1, totalPages: 1, total: 1 },
    }

    renderOrdersPage()

    expect(screen.queryByText(/\d+h \d+m/)).not.toBeInTheDocument()
    expect(screen.getByText(/AWAITING_PAYMENT/)).toBeInTheDocument()
  })

  // FR: §5 — COD processing has no badge
  it("does not show badge for COD processing order (§5 COD)", () => {
    mocks.ordersData = {
      orders: [
        listOrder({
          status: "processing",
          reserve_expires_at: isoInMs(24 * 60 * 60 * 1000),
          payment: { provider: "COD", payment_status: "pending" },
        }),
      ],
      pagination: { page: 1, totalPages: 1, total: 1 },
    }

    renderOrdersPage()

    expect(screen.queryByText(/\d+h \d+m/)).not.toBeInTheDocument()
  })

  // FR: §5 — AWAITING without reserve_expires_at
  it("does not show badge when reserve_expires_at is missing (§5)", () => {
    mocks.ordersData = {
      orders: [
        listOrder({
          reserve_expires_at: null,
        }),
      ],
      pagination: { page: 1, totalPages: 1, total: 1 },
    }

    renderOrdersPage()

    expect(screen.queryByText(/\d+h \d+m/)).not.toBeInTheDocument()
  })

  // FR: BR-03 — minute tick updates badge
  it("updates badge after 60s interval (BR-03)", async () => {
    mocks.ordersData = {
      orders: [
        listOrder({
          reserve_expires_at: isoInMs(2 * 60 * 60 * 1000 + 90 * 1000),
        }),
      ],
      pagination: { page: 1, totalPages: 1, total: 1 },
    }

    renderOrdersPage()
    expect(screen.getByText("2h 1m")).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.getByText("2h 0m")).toBeInTheDocument()
  })
})

describe("FR_OrderPaymentCountdownTimer — OrderDetailPage PaymentCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_MS)
    mocks.orderLoading = false
    mocks.orderDetailData = null
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // FR: §6 — HH:MM:SS display
  it("shows PaymentCountdown as HH:MM:SS when reserve_expires_at is present (§6)", () => {
    mocks.orderDetailData = {
      order: detailOrder({
        reserve_expires_at: isoInMs(65 * 1000),
      }),
    }

    renderOrderDetailPage()

    expect(
      screen.getByText(/Thời gian còn lại để thanh toán/i)
    ).toBeInTheDocument()
    expect(screen.getByText("00:01:05")).toBeInTheDocument()
  })

  // FR: §6 — warning <= 10 minutes
  it("shows red warning when 10 minutes or less remain (§6)", () => {
    mocks.orderDetailData = {
      order: detailOrder({
        reserve_expires_at: isoInMs(9 * 60 * 1000),
      }),
    }

    renderOrderDetailPage()

    expect(screen.getByText("00:09:00")).toHaveClass("text-red-600")
    expect(
      screen.getByText(/Chỉ còn ít thời gian/i)
    ).toBeInTheDocument()
  })

  it("does not show warning when more than 10 minutes remain (§6)", () => {
    mocks.orderDetailData = {
      order: detailOrder({
        reserve_expires_at: isoInMs(11 * 60 * 1000),
      }),
    }

    renderOrderDetailPage()

    expect(screen.getByText("00:11:00")).toHaveClass("text-orange-800")
    expect(screen.queryByText(/Chỉ còn ít thời gian/i)).not.toBeInTheDocument()
  })

  // FR: §6 — onExpired path (expired UI)
  it("runs expiry handler and shows expired message when timer reaches zero (§6 onExpired)", async () => {
    mocks.orderDetailData = {
      order: detailOrder({
        reserve_expires_at: isoInMs(2 * 1000),
      }),
    }

    renderOrderDetailPage()
    expect(screen.getByText("00:00:02")).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3_000)
    })

    expect(
      screen.getAllByText(/Đã hết thời gian thanh toán/i).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/00:00:/)).not.toBeInTheDocument()
  })

  // FR: GAP-01 — slim response without field
  it("does not mount PaymentCountdown when reserve_expires_at is absent (GAP-01)", () => {
    mocks.orderDetailData = {
      order: detailOrder({
        reserve_expires_at: undefined,
      }),
    }

    renderOrderDetailPage()

    expect(
      screen.queryByText(/Thời gian còn lại để thanh toán/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/00:\d{2}:\d{2}/)).not.toBeInTheDocument()
  })
})
