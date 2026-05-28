import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { useState } from "react"

const leafletMocks = vi.hoisted(() => ({
  clickHandler: null,
  setView: vi.fn(),
  invalidateSize: vi.fn(),
}))

vi.mock("leaflet", () => ({
  default: {
    Icon: {
      Default: {
        prototype: { _getIconUrl: "mock" },
        mergeOptions: vi.fn(),
      },
    },
  },
}))

vi.mock("react-leaflet", () => ({
  MapContainer: ({ center, zoom, children }) => (
    <div
      data-testid="map-container"
      data-center={JSON.stringify(center)}
      data-zoom={String(zoom)}
    >
      {children}
      <button
        type="button"
        data-testid="simulate-map-click"
        onClick={() =>
          leafletMocks.clickHandler?.({
            latlng: { lat: 10.8, lng: 106.8 },
          })
        }
      >
        map click
      </button>
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position, eventHandlers, draggable }) => (
    <div
      data-testid="map-marker"
      data-position={JSON.stringify(position)}
      data-draggable={String(draggable)}
    >
      <button
        type="button"
        data-testid="simulate-marker-drag"
        onClick={() => {
          const p = { lat: 10.81, lng: 106.81 }
          eventHandlers?.dragend?.({
            target: { getLatLng: () => p },
          })
        }}
      >
        marker drag
      </button>
    </div>
  ),
  useMap: () => ({
    setView: leafletMocks.setView,
    invalidateSize: leafletMocks.invalidateSize,
  }),
  useMapEvents: (handlers) => {
    leafletMocks.clickHandler = handlers?.click
    return null
  },
}))

import MapPicker from "./MapPicker"

const HCMC_CENTER = [10.776, 106.7]

function ControlledMapPicker({ onChange, onConfirm, initialValue = null }) {
  const [value, setValue] = useState(initialValue)
  return (
    <MapPicker
      value={value}
      onChange={(latlng) => {
        setValue(latlng)
        onChange?.(latlng)
      }}
      onConfirm={onConfirm}
    />
  )
}

describe("MapPicker", () => {
  beforeEach(() => {
    leafletMocks.clickHandler = null
    leafletMocks.setView.mockClear()
    leafletMocks.invalidateSize.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  // FR: §4 — default HCMC center
  it("uses HCMC default center when value is null (§4)", () => {
    render(<MapPicker onChange={vi.fn()} />)

    const map = screen.getByTestId("map-container")
    expect(JSON.parse(map.getAttribute("data-center"))).toEqual(HCMC_CENTER)
    expect(map.getAttribute("data-zoom")).toBe("15")
    expect(screen.queryByTestId("map-marker")).toBeNull()
  })

  // FR: §4 — center follows value
  it("centers MapContainer on value when provided (§4)", () => {
    const value = { lat: 10.5, lng: 106.5 }
    render(<MapPicker value={value} onChange={vi.fn()} />)

    const map = screen.getByTestId("map-container")
    expect(JSON.parse(map.getAttribute("data-center"))).toEqual([10.5, 106.5])
    expect(screen.getByTestId("map-marker")).toHaveAttribute(
      "data-position",
      JSON.stringify([10.5, 106.5])
    )
  })

  // FR: §4 — click map
  it("calls onChange when map is clicked (§4)", () => {
    const onChange = vi.fn()
    render(<ControlledMapPicker onChange={onChange} />)

    fireEvent.click(screen.getByTestId("simulate-map-click"))

    expect(onChange).toHaveBeenCalledWith({ lat: 10.8, lng: 106.8 })
    expect(screen.getByTestId("map-marker")).toBeInTheDocument()
  })

  // FR: §4 — drag marker
  it("calls onChange when marker is dragged (§4)", () => {
    const onChange = vi.fn()
    render(
      <MapPicker
        value={{ lat: 10.776, lng: 106.7 }}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByTestId("simulate-marker-drag"))

    expect(onChange).toHaveBeenCalledWith({ lat: 10.81, lng: 106.81 })
  })

  // FR: §4 — confirm
  it("calls onConfirm with current value when confirm is clicked (§4)", () => {
    const onConfirm = vi.fn()
    const value = { lat: 10.776889, lng: 106.700806 }
    render(<MapPicker value={value} onChange={vi.fn()} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole("button", { name: /xác nhận vị trí/i }))

    expect(onConfirm).toHaveBeenCalledWith(value)
  })

  // FR: §4 — RecenterOnLocation
  it("recenters map when value changes (§4)", async () => {
    const { rerender } = render(
      <MapPicker value={{ lat: 10.1, lng: 106.1 }} onChange={vi.fn()} />
    )

    await waitFor(() => {
      expect(leafletMocks.setView).toHaveBeenCalledWith(
        [10.1, 106.1],
        17,
        expect.objectContaining({ animate: true })
      )
    })

    rerender(<MapPicker value={{ lat: 10.9, lng: 106.9 }} onChange={vi.fn()} />)

    await waitFor(() => {
      expect(leafletMocks.setView).toHaveBeenCalledWith(
        [10.9, 106.9],
        17,
        expect.objectContaining({ animate: true })
      )
    })
  })

  // FR: §4 — negative confirm disabled
  it("disables confirm button when value is missing (§4)", () => {
    render(<MapPicker onChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByRole("button", { name: /xác nhận vị trí/i })).toBeDisabled()
  })

  // FR: §4 — negative onConfirm not called
  it("does not call onConfirm when value is missing (§4)", () => {
    const onConfirm = vi.fn()
    render(<MapPicker onChange={vi.fn()} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole("button", { name: /xác nhận vị trí/i }))

    expect(onConfirm).not.toHaveBeenCalled()
  })

  // FR: §4 — missing onConfirm safe
  it("does not throw when onConfirm is omitted and confirm is clicked (§4)", () => {
    render(
      <MapPicker value={{ lat: 10.776, lng: 106.7 }} onChange={vi.fn()} />
    )

    expect(() => {
      fireEvent.click(screen.getByRole("button", { name: /xác nhận vị trí/i }))
    }).not.toThrow()
  })
})
