/**
 * Generates docs/reports/shipping/UnitTest_ReverseGeocodeAddress.xlsx
 * Usage: node scripts/generateUnitTestReverseGeocodeAddressReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "removeAccents",
    input: "chuỗi có dấu",
    condition: "§5",
    expected: "bỏ dấu tiếng Việt",
    type: "Positive",
    fr: "§5",
    test: "strips Vietnamese diacritics for regex matching (§5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 2,
    feature: "cleanAddressDetail",
    input: "address + ward + province trùng",
    condition: "§5",
    expected: "loại ward/province/token hành chính",
    type: "Positive",
    fr: "§5",
    test: "removes ward, province and administrative tokens from address (§5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 3,
    feature: "cleanAddressDetail",
    input: "dấu phẩy/thừa khoảng trắng",
    condition: "§5",
    expected: "chuỗi gọn",
    type: "Positive",
    fr: "§5",
    test: "normalizes commas and collapses extra spaces (§5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 4,
    feature: "cleanAddressDetail",
    input: "chỉ address",
    condition: "§5",
    expected: "trim",
    type: "Positive",
    fr: "§5",
    test: "returns trimmed detail when no ward or province provided (§5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 5,
    feature: "geocodeSimple success",
    input: "query hợp lệ",
    condition: "§4, BR-01",
    expected: "{ lat, lng } từ phần tử đầu",
    type: "Positive",
    fr: "§4 / BR-01",
    test: "returns lat/lng from first search result (§4, BR-01)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 6,
    feature: "Nominatim URL/headers",
    input: "geocodeSimple",
    condition: "§4",
    expected: "/search?format=json&limit=1; User-Agent",
    type: "Positive",
    fr: "§4",
    test: "calls Nominatim search with encoded query and required headers (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 7,
    feature: "Query ward+province",
    input: "buildWardProvinceQuery",
    condition: "§5",
    expected: "Ward, Province, Vietnam",
    type: "Positive",
    fr: "§5",
    test: "builds ward province Vietnam query for useEffect geocode (§5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 8,
    feature: "Query full address",
    input: "buildFullAddressQuery",
    condition: "§5",
    expected: "detail, ward, province, Vietnam",
    type: "Positive",
    fr: "§5",
    test: "builds full address query with ward province Vietnam (§5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 9,
    feature: "Geocode empty",
    input: "[]",
    condition: "BR-02",
    expected: "null",
    type: "Negative",
    fr: "BR-02",
    test: "returns null when Nominatim returns empty array (BR-02)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 10,
    feature: "Geocode invalid shape",
    input: "object không phải array",
    condition: "BR-02",
    expected: "null",
    type: "Negative",
    fr: "BR-02",
    test: "returns null when response is not a non-empty array (BR-02)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 11,
    feature: "Geocode network error",
    input: "fetch throw",
    condition: "BR-02",
    expected: "reject",
    type: "Negative",
    fr: "BR-02",
    test: "rejects when fetch throws (BR-02)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 12,
    feature: "Không gọi /reverse",
    input: "nhiều forward geocode",
    condition: "GAP-01",
    expected: "chỉ /search",
    type: "Negative",
    fr: "GAP-01",
    test: "never calls nominatim /reverse during forward geocode flows (GAP-01)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 13,
    feature: "Reverse URL pattern",
    input: "buildSearchUrl vs reverse",
    condition: "GAP-01",
    expected: "search URL không chứa /reverse",
    type: "Negative",
    fr: "GAP-01",
    test: "documents that reverse URL pattern is not used by forward-only helper (GAP-01)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 14,
    feature: "Checkout blur geocode",
    input: "blur address có tỉnh+xã",
    condition: "§10",
    expected: "fetch /search; không /reverse",
    type: "Positive",
    fr: "§10",
    test: "calls Nominatim search on address blur when province and ward are set (§10)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 15,
    feature: "Checkout banner success",
    input: "geocode hit",
    condition: "§6",
    expected: "banner Đã tìm thấy vị trí",
    type: "Positive",
    fr: "§6",
    test: "shows success banner after geocode finds a location (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 16,
    feature: "Checkout banner warning",
    input: "geocode []",
    condition: "BR-02",
    expected: "banner không tìm thấy",
    type: "Negative",
    fr: "BR-02",
    test: "shows warning banner when Nominatim returns no results on blur (BR-02)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 17,
    feature: "Reverse geocode",
    input: "lat/lng → address",
    condition: "§7 Out of Scope",
    expected: "chưa implement",
    type: "Ref",
    fr: "GAP-01",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 18,
    feature: "Client-side CORS",
    input: "browser → Nominatim",
    condition: "GAP-02",
    expected: "không qua BE",
    type: "Ref",
    fr: "GAP-02",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 19,
    feature: "mapCenter không wired",
    input: "setMapCenter sau geocode",
    condition: "GAP-03",
    expected: "MapPicker không đọc props",
    type: "Ref",
    fr: "GAP-03",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 20,
    feature: "Centroid API dead",
    input: "geoFallbackToWardCenter",
    condition: "GAP-04",
    expected: "không gọi /geo/wards/centroid",
    type: "Ref",
    fr: "GAP-04",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/shipping")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ReverseGeocode")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/shipping/FR_ReverseGeocodeAddress.md | client/app/utils/__tests__/geocodeForward.test.js | client/app/pages/CheckoutPage.geocode.test.jsx"
  sheet.getCell("A1").font = { bold: true }

  const headers = [
    "ID",
    "Tính năng",
    "Đầu vào",
    "Điều kiện kiểm thử",
    "Kết quả mong đợi",
    "Loại",
    "Mã FR",
    "Tên test",
    "Kết quả thực tế",
    "Layer",
  ]
  sheet.addRow(headers)
  sheet.getRow(2).font = { bold: true }

  rows.forEach((r) => {
    sheet.addRow([
      r.id,
      r.feature,
      r.input,
      r.condition,
      r.expected,
      r.type,
      r.fr,
      r.test,
      r.result,
      r.layer,
    ])
  })

  sheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 40 },
    { width: 18 },
    { width: 44 },
    { width: 12 },
    { width: 14 },
    { width: 58 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(outDir, "UnitTest_ReverseGeocodeAddress.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
