/**
 * Generates docs/reports/UnitTest_CompareProducts.xlsx
 * Usage: node scripts/generateUnitTestCompareProductsReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Thêm vào danh sách so sánh",
    input: "addCompare(payload)",
    condition: "AC1",
    expected: "items.length=1; variation_id lưu đúng",
    type: "Positive",
    fr: "AC1",
    test: "adds a new item to compare list (AC1)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 2,
    feature: "Không trùng variation_id",
    input: "addCompare cùng variation_id",
    condition: "BR-02, AC1",
    expected: "items.length vẫn 1; giữ payload đầu",
    type: "Positive",
    fr: "BR-02 / AC1",
    test: "does not add duplicate variation_id (BR-02, AC1)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 3,
    feature: "FIFO khi thêm SP thứ 4",
    input: "addCompare id 1..4",
    condition: "BR-01, AC2",
    expected: "items [2,3,4]; bỏ item 1",
    type: "Positive",
    fr: "BR-01 / AC2",
    test: "evicts oldest item when adding a fourth (BR-01, AC2)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 4,
    feature: "Tối đa 3 items",
    input: "addCompare liên tiếp 5 lần",
    condition: "BR-01",
    expected: "items.length luôn ≤ 3",
    type: "Positive",
    fr: "BR-01",
    test: "keeps at most 3 items after multiple adds (BR-01)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 5,
    feature: "Xóa 1 item so sánh",
    input: "removeCompare(variation_id)",
    condition: "AC1",
    expected: "item bị loại khỏi items",
    type: "Positive",
    fr: "AC1",
    test: "removes item by variation_id (AC1)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 6,
    feature: "Xóa variation không tồn tại",
    input: "removeCompare(999)",
    condition: "Edge",
    expected: "items không đổi",
    type: "Negative",
    fr: "Edge",
    test: "removeCompare with unknown variation_id leaves list unchanged",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 7,
    feature: "Xóa tất cả",
    input: "clearCompare()",
    condition: "AC5",
    expected: "items = []",
    type: "Positive",
    fr: "AC5",
    test: "clears all compare items (AC5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 8,
    feature: "Nút So sánh ≥2 items",
    input: "CompareBar disabled",
    condition: "AC3, BR-03",
    expected: "N/A — UI CompareBar",
    type: "Ref",
    fr: "AC3 / BR-03",
    test: "—",
    result: "N/A",
    layer: "Client",
  },
  {
    id: 9,
    feature: "Modal giá gốc / sau giảm",
    input: "CompareModal render",
    condition: "AC4",
    expected: "N/A — UI CompareModal",
    type: "Ref",
    fr: "AC4",
    test: "—",
    result: "N/A",
    layer: "Client",
  },
  {
    id: 10,
    feature: "POST compare matrix",
    input: "POST { ids: [1,2] }",
    condition: "§8",
    expected: "200; products[]; compare[] group/rows",
    type: "Positive",
    fr: "§8",
    test: "returns 200 with products and compare matrix for POST ids [1,2]",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 11,
    feature: "POST ids rỗng",
    input: "POST { ids: [] }",
    condition: "§8",
    expected: "400; message ids required",
    type: "Negative",
    fr: "§8",
    test: "returns 400 when ids array is empty (POST)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 12,
    feature: "GET query rỗng (controller)",
    input: "query ids=",
    condition: "§8, route order",
    expected: "400; không gọi findAll",
    type: "Negative",
    fr: "§8",
    test: "returns 400 when query ids is empty via controller invoke",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 13,
    feature: "GET ids qua controller",
    input: 'query ids="1,2,3"',
    condition: "§8",
    expected: "findAll Op.in; matrix display+performance",
    type: "Positive",
    fr: "§8",
    test: 'loads products for query ids "1,2,3" via controller (GET)',
    result: "Pass",
    layer: "Server",
  },
  {
    id: 14,
    feature: "Matrix thiếu label",
    input: "2 products specs khác nhau",
    condition: "§8",
    expected: 'values ["FHD","—"] cho label thiếu',
    type: "Positive",
    fr: "§8",
    test: "fills compare matrix values with em dash when label missing on a product",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 15,
    feature: "Lỗi DB",
    input: "findAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Product.findAll throws",
    result: "Pass",
    layer: "Server",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_CompareProducts")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_CompareProducts.md | client: compareSlice.test.js | server: compareProducts.test.js"
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
    { width: 36 },
    { width: 22 },
    { width: 44 },
    { width: 12 },
    { width: 18 },
    { width: 62 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_CompareProducts.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
