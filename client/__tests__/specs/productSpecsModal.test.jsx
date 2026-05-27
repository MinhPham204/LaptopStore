import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import SpecsTable from "../../app/components/SpecsTable.jsx"
import SpecsModal from "../../app/components/SpecsModal.jsx"

// Copied from ProductDetailPage.jsx — not exported from production
const title = (s) =>
  String(s)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

const toText = (val) => {
  if (val == null) return ""
  if (Array.isArray(val)) return val.map(toText).filter(Boolean).join(", ")
  if (typeof val === "object") {
    return val.value ?? val.name ?? val.label ?? Object.values(val).join(" ")
  }
  return String(val)
}

const normalizeSpecs = (specs) => {
  if (!specs) return {}
  const out = {}
  Object.entries(specs).forEach(([section, entries]) => {
    if (Array.isArray(entries)) {
      entries.forEach((item, i) => {
        const k =
          item.key ?? item.name ?? item.label ?? `${title(section)} ${i + 1}`
        out[k] = toText(item.value ?? item)
      })
    } else if (typeof entries === "object") {
      Object.entries(entries).forEach(([k, v]) => {
        out[`${title(section)} - ${title(k)}`] = toText(v)
      })
    } else {
      out[title(section)] = toText(entries)
    }
  })
  return out
}

const buildBriefSpecs = (flatSpecs) =>
  Object.fromEntries(Object.entries(flatSpecs).slice(0, 6))

const FR_EXAMPLE_SPECS = {
  weight: "1.8kg",
  display: [
    { label: "Kích thước", value: "15.6 inch" },
    { label: "Độ phân giải", value: "FHD IPS" },
  ],
  audio: { speakers: "Stereo" },
}

describe("normalizeSpecs (ProductDetailPage formula)", () => {
  // FR: AC4 — specs null/empty
  it("returns empty object for null or empty specs", () => {
    expect(normalizeSpecs(null)).toEqual({})
    expect(normalizeSpecs({})).toEqual({})
  })

  // FR: AC1 / AC2 — FR example JSON shapes
  it("flattens display array, audio object, and weight scalar from FR example", () => {
    const flat = normalizeSpecs(FR_EXAMPLE_SPECS)

    expect(flat).toEqual({
      Weight: "1.8kg",
      "Kích thước": "15.6 inch",
      "Độ phân giải": "FHD IPS",
      "Audio - Speakers": "Stereo",
    })
  })

  // FR: AC1 — briefSpecs = first 6 entries
  it("builds briefSpecs from the first six flat entries only", () => {
    const many = {
      a: "1",
      b: "2",
      c: "3",
      d: "4",
      e: "5",
      f: "6",
      g: "7",
      h: "8",
    }
    const flat = normalizeSpecs(many)
    const brief = buildBriefSpecs(flat)

    expect(Object.keys(flat)).toHaveLength(8)
    expect(Object.keys(brief)).toHaveLength(6)
    expect(Object.keys(brief)).toEqual(Object.keys(flat).slice(0, 6))
    expect(brief).toEqual({
      A: "1",
      B: "2",
      C: "3",
      D: "4",
      E: "5",
      F: "6",
    })
  })

  // FR: AC2 — nested object keys "Section - Key"
  it('uses "Display - Kích thước" style keys for nested objects', () => {
    const flat = normalizeSpecs({
      display: { kich_thuoc: "15.6 inch", do_phan_giai: "FHD IPS" },
    })

    expect(flat).toEqual({
      "Display - Kich Thuoc": "15.6 inch",
      "Display - Do Phan Giai": "FHD IPS",
    })
  })
})

describe("SpecsTable", () => {
  afterEach(() => cleanup())

  // FR: AC4
  it('shows empty message when specs is empty', () => {
    render(<SpecsTable specs={{}} />)
    expect(screen.getByText("Chưa có thông số kỹ thuật.")).toBeInTheDocument()
  })

  // FR: AC1
  it("renders label and value rows for normalized specs", () => {
    render(
      <SpecsTable
        specs={{
          CPU: "Intel i7",
          RAM: "16GB",
        }}
      />
    )

    expect(screen.getByRole("columnheader", { name: "CPU" })).toBeInTheDocument()
    expect(screen.getByText("Intel i7")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "RAM" })).toBeInTheDocument()
    expect(screen.getByText("16GB")).toBeInTheDocument()
  })
})

describe("SpecsModal", () => {
  afterEach(() => cleanup())

  // FR: AC2 / AC3 — closed vs open
  it("renders null when open is false", () => {
    const { container } = render(
      <SpecsModal open={false} onClose={vi.fn()} specs={{ CPU: "i5" }} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders title and SpecsTable when open is true", () => {
    render(
      <SpecsModal
        open={true}
        onClose={vi.fn()}
        specs={{ "Kích thước": "15.6 inch", RAM: "16GB" }}
      />
    )

    expect(screen.getByRole("heading", { name: "Thông số kỹ thuật" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Kích thước" })).toBeInTheDocument()
    expect(screen.getByText("15.6 inch")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "RAM" })).toBeInTheDocument()
  })

  // FR: AC3 — backdrop closes modal
  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn()
    const { container } = render(
      <SpecsModal open={true} onClose={onClose} specs={{ CPU: "i5" }} />
    )

    const backdrop = container.querySelector(".backdrop-blur-sm")
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
