import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  removeAccents,
  cleanAddressDetail,
  geocodeSimple,
  buildSearchUrl,
  buildWardProvinceQuery,
  buildFullAddressQuery,
  NOMINATIM_SEARCH_BASE,
  GEOCODE_USER_AGENT,
  findNominatimReverseUrls,
  collectFetchUrls,
} from "./geocodeForwardHelpers.js"

describe("removeAccents (CheckoutPage mirror)", () => {
  it("strips Vietnamese diacritics for regex matching (§5)", () => {
    expect(removeAccents("Phường Hiệp Bình")).toBe("Phuong Hiep Binh")
    expect(removeAccents("Đà Nẵng")).toBe("da Nang")
  })
})

describe("cleanAddressDetail (CheckoutPage mirror)", () => {
  // FR: §5 — strip admin tokens and ward/province duplicates (ASCII names match \b patterns)
  it("removes ward, province and administrative tokens from address (§5)", () => {
    const cleaned = cleanAddressDetail(
      "109 Le Loi, Phuong 1, TP HCM",
      "Phuong 1",
      "TP HCM"
    )

    expect(cleaned).toBe("109 Le Loi")
  })

  it("normalizes commas and collapses extra spaces (§5)", () => {
    expect(cleanAddressDetail("109,,  Le   Loi", "", "")).toBe("109 Le Loi")
  })

  it("returns trimmed detail when no ward or province provided (§5)", () => {
    expect(cleanAddressDetail("  12 Lê Lợi  ")).toBe("12 Lê Lợi")
  })
})

describe("geocodeSimple — forward Nominatim /search (CheckoutPage mirror)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => [{ lat: "10.776889", lon: "106.700806" }],
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // FR: §4 / BR-01 — success
  it("returns lat/lng from first search result (§4, BR-01)", async () => {
    const result = await geocodeSimple("109 Hiệp Bình, Phường 1, TP HCM, Vietnam")

    expect(result).toEqual({ lat: 10.776889, lng: 106.700806 })
    expect(findNominatimReverseUrls()).toEqual([])
  })

  // FR: §4 — URL and headers
  it("calls Nominatim search with encoded query and required headers (§4)", async () => {
    const query = "Phường 1, TP HCM, Vietnam"
    await geocodeSimple(query)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(buildSearchUrl(query), {
      headers: {
        Accept: "application/json",
        "User-Agent": GEOCODE_USER_AGENT,
      },
    })
    expect(String(global.fetch.mock.calls[0][0])).toMatch(
      /^https:\/\/nominatim\.openstreetmap\.org\/search\?format=json&limit=1&q=/
    )
    expect(findNominatimReverseUrls()).toEqual([])
  })

  // FR: §5 — ward + province query builder
  it("builds ward province Vietnam query for useEffect geocode (§5)", async () => {
    const q = buildWardProvinceQuery("Phường 1", "TP HCM")
    await geocodeSimple(q)

    expect(global.fetch.mock.calls[0][0]).toBe(buildSearchUrl(q))
    expect(findNominatimReverseUrls()).toEqual([])
  })

  // FR: §5 — full address query (geocodeAddress style)
  it("builds full address query with ward province Vietnam (§5)", async () => {
    const q = buildFullAddressQuery("109 Test Street", "Phường 1", "TP HCM")
    await geocodeSimple(q)

    expect(global.fetch.mock.calls[0][0]).toBe(buildSearchUrl(q))
    expect(findNominatimReverseUrls()).toEqual([])
  })

  // FR: BR-02 — empty results
  it("returns null when Nominatim returns empty array (BR-02)", async () => {
    global.fetch.mockResolvedValueOnce({ json: async () => [] })

    const result = await geocodeSimple("nowhere, Vietnam")

    expect(result).toBeNull()
    expect(findNominatimReverseUrls()).toEqual([])
  })

  // FR: BR-02 — invalid JSON shape
  it("returns null when response is not a non-empty array (BR-02)", async () => {
    global.fetch.mockResolvedValueOnce({ json: async () => ({ error: "no results" }) })

    const result = await geocodeSimple("invalid shape")

    expect(result).toBeNull()
    expect(findNominatimReverseUrls()).toEqual([])
  })

  // FR: BR-02 — fetch throws
  it("rejects when fetch throws (BR-02)", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network down"))

    await expect(geocodeSimple("109 Test")).rejects.toThrow("Network down")
    expect(findNominatimReverseUrls()).toEqual([])
  })
})

describe("GAP-01 — reverse geocode not implemented", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => [{ lat: "10.77", lon: "106.70" }],
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("never calls nominatim /reverse during forward geocode flows (GAP-01)", async () => {
    await geocodeSimple("TP HCM, Vietnam")
    await geocodeSimple(buildWardProvinceQuery("Phường 1", "TP HCM"))

    const urls = collectFetchUrls()
    expect(urls.length).toBeGreaterThanOrEqual(2)
    expect(urls.every((u) => u.startsWith(NOMINATIM_SEARCH_BASE.split("?")[0]))).toBe(
      true
    )
    expect(findNominatimReverseUrls()).toEqual([])
  })

  it("documents that reverse URL pattern is not used by forward-only helper (GAP-01)", () => {
    const reverseUrl =
      "https://nominatim.openstreetmap.org/reverse?lat=10.77&lon=106.7&format=json"
    expect(reverseUrl).toMatch(/\/reverse\?/)
    expect(buildSearchUrl("test")).not.toMatch(/\/reverse/)
  })
})
