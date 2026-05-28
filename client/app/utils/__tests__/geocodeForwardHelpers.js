/**
 * Mirrors CheckoutPage.jsx geocode helpers (FR_ReverseGeocodeAddress — forward only).
 * Test-only copy; production logic stays in CheckoutPage.jsx.
 */

export const NOMINATIM_SEARCH_BASE =
  "https://nominatim.openstreetmap.org/search?format=json&limit=1&q="

export const GEOCODE_USER_AGENT =
  "laptopstore-checkout/1.0 (contact: your-email@example.com)"

export function removeAccents(s = "") {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
}

export function cleanAddressDetail(addr = "", wardName = "", provinceName = "") {
  let a = addr.trim()
  const adminWords = [
    "phường",
    "p.",
    "p ",
    "xã",
    "x.",
    "x ",
    "quận",
    "q.",
    "q ",
    "huyện",
    "h.",
    "h ",
    "thành phố",
    "tp.",
    "tp ",
    "tỉnh",
    "thị xã",
    "tx.",
    "tx ",
  ]
  const patterns = [
    wardName,
    provinceName,
    ...adminWords.map((w) => `\\b${w}\\b`),
  ]
    .filter(Boolean)
    .map((w) => removeAccents(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))

  if (patterns.length) {
    const reWord = new RegExp(`(?:${patterns.join("|")})`, "gi")
    a = a.replace(reWord, " ")
  }
  a = a
    .replace(/[,]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
  return a
}

export function buildSearchUrl(query) {
  return `${NOMINATIM_SEARCH_BASE}${encodeURIComponent(query)}`
}

export function buildWardProvinceQuery(wardName, provinceName) {
  return `${wardName}, ${provinceName}, Vietnam`
}

export function buildFullAddressQuery(addressDetail, wardName, provinceName) {
  return `${addressDetail}, ${wardName}, ${provinceName}, Vietnam`
}

/** Mirror CheckoutPage geocodeSimple */
export async function geocodeSimple(query) {
  const url = buildSearchUrl(query)
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": GEOCODE_USER_AGENT,
    },
  })
  const arr = await res.json()
  if (Array.isArray(arr) && arr.length > 0) {
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) }
  }
  return null
}

export function collectFetchUrls(fetchMock = global.fetch) {
  if (!fetchMock?.mock?.calls) return []
  return fetchMock.mock.calls.map((call) => String(call[0]))
}

export function findNominatimReverseUrls(fetchMock = global.fetch) {
  return collectFetchUrls(fetchMock).filter((u) =>
    /nominatim\.openstreetmap\.org\/reverse/i.test(u)
  )
}
