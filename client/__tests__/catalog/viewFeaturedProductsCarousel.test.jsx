import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { useEffect, useRef } from "react"

// Copied from HomePage.jsx — carousel index helpers (not exported from production)
const featuredNextIndex = (current, count) => {
  if (!count) return current
  return (current + 1) % count
}

const featuredPrevIndex = (current, count) => {
  if (!count) return current
  return (current - 1 + count) % count
}

const scrollFeaturedLeft = (index, itemW, gap = 16) => {
  if (!itemW) return 0
  return index * (itemW + gap)
}

const mocks = vi.hoisted(() => ({
  useProductsV2: vi.fn(),
}))

vi.mock("../../app/hooks/useProducts", () => ({
  useProductsV2: (filters) => mocks.useProductsV2(filters),
  useProducts: () => ({ data: null, isLoading: false }),
  useProductFacets: () => ({ data: { facets: {} } }),
  customerUseBrandsFull: () => ({ data: [] }),
  customerUseCategoriesFull: () => ({ data: [] }),
}))

vi.mock("../../app/components/ProductCard", () => ({
  default: ({ product }) => (
    <div data-testid="featured-product-card">{product.product_name}</div>
  ),
}))

vi.mock("../../app/components/ProductFilter", () => ({ default: () => null }))
vi.mock("../../app/components/LoadingSpinner", () => ({ default: () => null }))

import HomePage from "../../app/pages/HomePage"

const featuredProducts = [
  { product_id: 1, product_name: "Featured A", slug: "featured-a" },
  { product_id: 2, product_name: "Featured B", slug: "featured-b" },
  { product_id: 3, product_name: "Featured C", slug: "featured-c" },
]

const setupUseProductsV2 = ({ featuredLoading = false, featured = featuredProducts } = {}) => {
  mocks.useProductsV2.mockImplementation((filters) => {
    if (filters?.sortBy === "best_selling") {
      return {
        data: featuredLoading ? undefined : { products: featured },
        isLoading: featuredLoading,
      }
    }
    return {
      data: { products: [], total: 0, totalPages: 0 },
      isLoading: false,
      error: null,
    }
  })
}

/** Minimal timer probe mirroring HomePage startFeaturedTimer (1000ms). */
function FeaturedTimerProbe({ count, onTick }) {
  const indexRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!count) return undefined
    indexRef.current = 0
    timerRef.current = setInterval(() => {
      indexRef.current = featuredNextIndex(indexRef.current, count)
      onTick(indexRef.current)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [count, onTick])

  return null
}

describe("featured carousel logic (HomePage formula)", () => {
  // FR: AC4 — circular next/prev indices
  it("featuredNextIndex wraps modulo product count (AC4)", () => {
    expect(featuredNextIndex(0, 3)).toBe(1)
    expect(featuredNextIndex(2, 3)).toBe(0)
  })

  it("featuredPrevIndex wraps modulo product count (AC4)", () => {
    expect(featuredPrevIndex(0, 3)).toBe(2)
    expect(featuredPrevIndex(1, 3)).toBe(0)
  })

  it("scrollFeaturedLeft uses item width plus 16px gap", () => {
    expect(scrollFeaturedLeft(2, 240)).toBe(512)
    expect(scrollFeaturedLeft(1, 0)).toBe(0)
  })
})

describe("HomePage featured section", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ questions: [], total: 0 }),
      })
    )
    setupUseProductsV2()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // FR: AC2 — featuredFilters → useProductsV2
  it("calls useProductsV2 with page 1 limit 12 sortBy best_selling (AC2)", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(mocks.useProductsV2).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 12,
        sortBy: "best_selling",
      })
    )
  })

  // FR: AC1 — render up to featured products from hook
  it("renders featured ProductCard entries when hook returns 3 products (AC1)", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(screen.getByText("🔥 SẢN PHẨM NỔI BẬT")).toBeInTheDocument()
    const cards = await screen.findAllByTestId("featured-product-card")
    expect(cards).toHaveLength(3)
    expect(screen.getByText("Featured A")).toBeInTheDocument()
    expect(screen.getByText("Featured C")).toBeInTheDocument()
  })

  // FR: §8 — empty state copy
  it('shows empty message when featured products list is empty', async () => {
    setupUseProductsV2({ featured: [] })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(await screen.findByText("Chưa có sản phẩm nổi bật.")).toBeInTheDocument()
  })

  // FR: AC3 — auto-advance interval 1s (fake timers)
  it("auto-advances featured index every 1 second (AC3)", () => {
    vi.useFakeTimers()
    const onTick = vi.fn()

    render(<FeaturedTimerProbe count={3} onTick={onTick} />)

    vi.advanceTimersByTime(1000)
    expect(onTick).toHaveBeenCalledWith(1)

    vi.advanceTimersByTime(1000)
    expect(onTick).toHaveBeenLastCalledWith(2)

    vi.useRealTimers()
  })

  // FR: AC4 — prev/next buttons present on featured section
  it("exposes prev and next carousel controls (AC4)", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(screen.getByLabelText("Previous featured products")).toBeInTheDocument()
    expect(screen.getByLabelText("Next featured products")).toBeInTheDocument()
  })

  // FR: AC3 — hover stops timer (stopFeaturedTimer on mouse enter)
  it("clears featured timer on mouse enter over carousel track (AC3)", async () => {
    vi.useFakeTimers()
    const clearIntervalSpy = vi.spyOn(global, "clearInterval")

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    const track = document.querySelector(".overflow-x-auto.scroll-smooth")
    expect(track).toBeTruthy()

    fireEvent.mouseEnter(track)
    expect(clearIntervalSpy).toHaveBeenCalled()

    clearIntervalSpy.mockRestore()
    vi.useRealTimers()
  })
})
