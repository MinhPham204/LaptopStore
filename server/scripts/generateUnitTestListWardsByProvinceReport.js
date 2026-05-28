/**
 * Generates docs/reports/admin/UnitTest_ListWardsByProvince.xlsx
 * Usage: node scripts/generateUnitTestListWardsByProvinceReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách phường/xã",
    input: "GET /api/provinces/79/wards",
    condition: "§4, AC",
    expected: "200; ward_id, name, slug, extra_fee, province_id",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 200 with ward fields on each row (§4, AC)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 2,
    feature: "findAll args",
    input: "spy Ward.findAll",
    condition: "§5",
    expected: "where province_id; order name ASC; attributes đủ 5 field",
    type: "Positive",
    fr: "§5",
    test: "calls Ward.findAll with province_id filter, name ASC, and attributes (§5)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 3,
    feature: "Danh sách rỗng",
    input: "findAll []",
    condition: "§4",
    expected: "200 []",
    type: "Positive",
    fr: "§4",
    test: "returns 200 with empty array when province has no wards (§4)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 4,
    feature: "Province id không tồn tại",
    input: "GET /api/provinces/99999/wards",
    condition: "GAP-03",
    expected: "200 []; không validate province",
    type: "Positive",
    fr: "GAP-03",
    test: "returns 200 with empty array for unknown province id without validation (GAP-03)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 5,
    feature: "Public API",
    input: "GET không Authorization",
    condition: "BR-01",
    expected: "200; không JWT",
    type: "Positive",
    fr: "BR-01",
    test: "returns 200 without Authorization header (BR-01)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 6,
    feature: "Lỗi DB",
    input: "Ward.findAll throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when Ward.findAll throws",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 7,
    feature: "Hook gọi API",
    input: "useWards(79)",
    condition: "§6, AC",
    expected: "GET /provinces/79/wards",
    type: "Positive",
    fr: "§6 / AC",
    test: "calls GET /provinces/79/wards when provinceId is 79 (§6, AC)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 8,
    feature: "Hook data",
    input: "mock response",
    condition: "§6",
    expected: "data = wards array",
    type: "Positive",
    fr: "§6",
    test: "populates data from API response (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 9,
    feature: "Hook loading",
    input: "provinceId set",
    condition: "§6",
    expected: "loading true → false",
    type: "Positive",
    fr: "§6",
    test: "sets loading true then false when provinceId is set (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 10,
    feature: "Đổi tỉnh",
    input: "rerender provinceId 79 → 1",
    condition: "BR-02",
    expected: "2 lần GET; data đổi theo tỉnh",
    type: "Positive",
    fr: "BR-02",
    test: "refetches wards when provinceId changes (BR-02)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 11,
    feature: "provinceId falsy",
    input: "null / \"\" / undefined",
    condition: "BR-01",
    expected: "không api.get; data []",
    type: "Negative",
    fr: "BR-01",
    test: "does not call api and keeps data empty when provinceId is null (BR-01)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 12,
    feature: "provinceId falsy",
    input: "empty string",
    condition: "BR-01",
    expected: "không api.get; data []",
    type: "Negative",
    fr: "BR-01",
    test: 'does not call api and keeps data empty when provinceId is empty string (BR-01)',
    result: "Pass",
    layer: "Client",
  },
  {
    id: 13,
    feature: "provinceId falsy",
    input: "undefined",
    condition: "BR-01",
    expected: "không api.get; data []",
    type: "Negative",
    fr: "BR-01",
    test: "does not call api and keeps data empty when provinceId is undefined (BR-01)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 14,
    feature: "Unmount cleanup",
    input: "unmount trước resolve",
    condition: "§6",
    expected: "không cập nhật state",
    type: "Positive",
    fr: "§6",
    test: "does not update state after unmount when request resolves late (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 15,
    feature: "geoAPI path sai",
    input: "geoAPI.getWards → /wards?province_id=",
    condition: "GAP-01",
    expected: "BE dùng /provinces/:id/wards",
    type: "Ref",
    fr: "GAP-01",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 16,
    feature: "Centroid endpoint",
    input: "GET /geo/wards/:id/centroid",
    condition: "GAP-02",
    expected: "Route không tồn tại; dead code FE",
    type: "Ref",
    fr: "GAP-02",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ListWardsByProvince")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/shipping/FR_ListWardsByProvince.md | server: listWardsByProvince.test.js | client: useWards.test.js"
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

  const outPath = path.join(outDir, "UnitTest_ListWardsByProvince.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
