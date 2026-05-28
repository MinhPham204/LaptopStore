import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, cleanup } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  search: "",
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mocks.mockNavigate,
    useLocation: () => ({
      pathname: "/checkout/vnpay-return",
      search: mocks.search,
    }),
  }
})

vi.mock("../../components/LoadingSpinner", () => ({
  default: () => <span data-testid="loading-spinner" />,
}))

import VnpayReturn from "./VnpayReturn"

describe("VnpayReturn — FR_VNPayReturnPage", () => {
  beforeEach(() => {
    mocks.mockNavigate.mockClear()
    mocks.search = ""
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  const expectNoApiCalls = () => {
    expect(global.fetch).not.toHaveBeenCalled()
  }

  // FR: AC §12 — status=success → tab to_ship, replace
  it("navigates to /orders?tab=to_ship with replace when status=success", async () => {
    mocks.search = "?status=success&orderId=42"

    render(<VnpayReturn />)

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/orders?tab=to_ship", {
        replace: true,
      })
    })
    expectNoApiCalls()
  })

  // FR: AC §12 — status=failed → tab failed, replace
  it("navigates to /orders?tab=failed with replace when status=failed", async () => {
    mocks.search = "?status=failed&orderId=42"

    render(<VnpayReturn />)

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith("/orders?tab=failed", {
        replace: true,
      })
    })
    expectNoApiCalls()
  })

  // FR: §6 fallback — thiếu status → countdown 5s → /orders replace
  it("navigates to /orders with replace after 5s when status is missing", async () => {
    vi.useFakeTimers()
    mocks.search = "?orderId=42"

    render(<VnpayReturn />)

    expect(screen.getByText(/thiếu tham số trạng thái/i)).toBeInTheDocument()
    expect(screen.getByText(/OrderId:/)).toBeInTheDocument()
    expect(mocks.mockNavigate).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(mocks.mockNavigate).toHaveBeenCalledWith("/orders", { replace: true })
    expectNoApiCalls()
  })

  // FR: §6 — status lạ → countdown path, không redirect tab ngay
  it("uses countdown fallback for unknown status and does not call API", async () => {
    vi.useFakeTimers()
    mocks.search = "?status=cancelled&orderId=99"

    render(<VnpayReturn />)

    expect(screen.getByText("cancelled")).toBeInTheDocument()
    expect(screen.queryByText(/thiếu tham số trạng thái/i)).not.toBeInTheDocument()
    expect(mocks.mockNavigate).not.toHaveBeenCalledWith(
      "/orders?tab=to_ship",
      expect.anything()
    )
    expect(mocks.mockNavigate).not.toHaveBeenCalledWith(
      "/orders?tab=failed",
      expect.anything()
    )

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(mocks.mockNavigate).toHaveBeenCalledWith("/orders", { replace: true })
    expectNoApiCalls()
  })

  // FR: BR-02 — hiển thị orderId từ query (không gọi API)
  it("displays orderId and status from query without API calls", () => {
    mocks.search = "?status=success&orderId=ORD-42"

    render(<VnpayReturn />)

    expect(screen.getByText("ORD-42")).toBeInTheDocument()
    expect(screen.getByText("success")).toBeInTheDocument()
    expectNoApiCalls()
  })
})
