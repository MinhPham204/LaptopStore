import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  locationState: undefined,
}))

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.mockNavigate,
  useLocation: () => ({ state: mocks.locationState }),
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

import CheckoutSuccessPage from "./CheckoutSuccessPage"

const codState = {
  order_code: "ORD-2026-001",
  customer_name: "Nguyen Van A",
  payment_provider: "COD",
}

const vnpayState = {
  order_code: "ORD-VNP-99",
  customer_name: "Tran Thi B",
  payment_provider: "VNPAY",
}

const renderSuccessPage = () => render(<CheckoutSuccessPage />)

describe("CheckoutSuccessPage", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.locationState = codState
  })

  afterEach(() => {
    cleanup()
  })

  // FR: AC1 / §7 — COD success UI
  it("renders COD success content with order code, customer name, and links (AC1)", () => {
    renderSuccessPage()

    expect(screen.getByRole("heading", { name: /đặt hàng thành công/i })).toBeInTheDocument()
    expect(screen.getByText("ORD-2026-001")).toBeInTheDocument()
    expect(screen.getByText(/Nguyen Van A/)).toBeInTheDocument()
    expect(screen.getByText(/thanh toán khi nhận hàng/i)).toBeInTheDocument()
    expect(screen.getByText(/email xác nhận đơn hàng/i)).toBeInTheDocument()
    expect(screen.getByText(/chuẩn bị/i)).toBeInTheDocument()
    expect(screen.getByText(/sms/i)).toBeInTheDocument()

    const ordersLink = screen.getByRole("link", { name: /xem chi tiết đơn hàng/i })
    expect(ordersLink).toHaveAttribute("href", "/orders")

    const homeLink = screen.getByRole("link", { name: /tiếp tục mua sắm/i })
    expect(homeLink).toHaveAttribute("href", "/")

    expect(mocks.mockNavigate).not.toHaveBeenCalled()
  })

  // FR: §7 — VNPAY copy (optional path)
  it("renders VNPay payment copy and bullets when payment_provider is VNPAY (§7)", () => {
    mocks.locationState = vnpayState
    renderSuccessPage()

    expect(screen.getByText("ORD-VNP-99")).toBeInTheDocument()
    expect(screen.getByText(/Tran Thi B/)).toBeInTheDocument()
    expect(screen.getByText(/ví điện tử vnpay/i)).toBeInTheDocument()
    expect(
      screen.getByText(/email xác nhận thanh toán thành công/i)
    ).toBeInTheDocument()
    expect(mocks.mockNavigate).not.toHaveBeenCalled()
  })

  // FR: AC2 / BR-01 — no state
  it('redirects to home when location state is null (AC2, BR-01)', async () => {
    mocks.locationState = null
    renderSuccessPage()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/", { replace: true })
    })
    expect(screen.queryByText(/đặt hàng thành công/i)).not.toBeInTheDocument()
  })

  it('redirects to home when location state is undefined (AC2, BR-01)', async () => {
    mocks.locationState = undefined
    renderSuccessPage()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/", { replace: true })
    })
  })

  // FR: §6 — missing required fields
  it("redirects when order_code is missing (§6)", async () => {
    mocks.locationState = {
      customer_name: "Nguyen Van A",
      payment_provider: "COD",
    }
    renderSuccessPage()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/", { replace: true })
    })
  })

  it("redirects when customer_name is missing (§6)", async () => {
    mocks.locationState = {
      order_code: "ORD-2026-001",
      payment_provider: "COD",
    }
    renderSuccessPage()

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/", { replace: true })
    })
  })
})
