/**
 * Generates docs/reports/admin/UnitTest_ListProvinces.xlsx
 * Usage: node scripts/generateUnitTestListProvincesReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách tỉnh/thành",
    input: "GET /api/provinces; mock 2 provinces",
    condition: "§4, AC",
    expected:
      "200; array; province_id, name, slug, is_hcm, base_shipping_fee, is_free_shipping, max_shipping_fee",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 200 with all shipping fields on each province (§4, AC)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 2,
    feature: "findAll order và attributes",
    input: "spy Province.findAll",
    condition: "§5",
    expected: "order [['name','ASC']]; attributes đủ 7 field",
    type: "Positive",
    fr: "§5",
    test: "calls Province.findAll with name ASC order and shipping attributes (§5)",
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
    test: "returns 200 with empty array when no provinces exist (§4)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 4,
    feature: "Public API",
    input: "GET không Authorization",
    condition: "BR-01",
    expected: "200; không yêu cầu JWT",
    type: "Positive",
    fr: "BR-01",
    test: "returns 200 without Authorization header (BR-01)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 5,
    feature: "Query fields bị bỏ qua",
    input: "GET ?fields=province_id,name",
    condition: "GAP-02",
    expected: "200; vẫn trả full shipping fields",
    type: "Positive",
    fr: "GAP-02",
    test: "returns full attributes when fields query param is sent (GAP-02)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 6,
    feature: "Lỗi DB",
    input: "Province.findAll throw",
    condition: "BR-03",
    expected: "500",
    type: "Negative",
    fr: "BR-03",
    test: "returns 500 when Province.findAll throws (BR-03)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 7,
    feature: "Hook gọi API",
    input: "renderHook useProvinces",
    condition: "§6",
    expected: "api.get('/provinces') đúng 1 lần",
    type: "Positive",
    fr: "§6",
    test: "calls GET /provinces once on mount (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 8,
    feature: "Hook data",
    input: "mock GET response",
    condition: "§6",
    expected: "data = provinces array",
    type: "Positive",
    fr: "§6",
    test: "populates data from API response (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 9,
    feature: "Hook loading",
    input: "sau resolve",
    condition: "§6",
    expected: "loading false",
    type: "Positive",
    fr: "§6",
    test: "sets loading to false after fetch resolves (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 10,
    feature: "Unmount cleanup",
    input: "unmount trước khi promise resolve",
    condition: "§6",
    expected: "không cập nhật state sau unmount",
    type: "Positive",
    fr: "§6",
    test: "does not update state after unmount when request resolves late (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 11,
    feature: "Hook lỗi API",
    input: "api.get reject",
    condition: "§6",
    expected: "loading false; data []",
    type: "Negative",
    fr: "§6",
    test: "sets loading false and keeps data empty when api.get rejects (§6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 12,
    feature: "Tham số hook bị bỏ qua",
    input: "useProvinces(true) như CheckoutPage",
    condition: "GAP-03",
    expected: "vẫn GET /provinces; không behavior khác",
    type: "Ref",
    fr: "GAP-03",
    test: "ignores arguments and still calls GET /provinces (GAP-03)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 13,
    feature: "geoAPI fields param",
    input: "geoAPI.getProvinces({ fields })",
    condition: "GAP-02",
    expected: "BE không đọc fields — documented",
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
  const sheet = workbook.addWorksheet("UnitTest_ListProvinces")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/shipping/FR_ListProvinces.md | server: listProvinces.test.js | client: useProvinces.test.js"
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
    { width: 20 },
    { width: 48 },
    { width: 12 },
    { width: 14 },
    { width: 58 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(outDir, "UnitTest_ListProvinces.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
