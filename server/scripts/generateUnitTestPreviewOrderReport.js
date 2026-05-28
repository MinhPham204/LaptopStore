/**
 * Generates docs/report/order/UnitTest_PreviewOrder.xlsx
 * Usage: node scripts/generateUnitTestPreviewOrderReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Preview thành công",
    input: "items + province_id + ward_id",
    condition: "AC §12, BR-01",
    expected: "200; totals; items_breakdown; stock_warnings=[]",
    type: "Positive",
    fr: "AC §12 / BR-01",
    test: "returns 200 with totals, items_breakdown and empty stock_warnings (AC §12, BR-01)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Công thức giảm giá",
    input: "price 10M, discount 15%, qty 2",
    condition: "BR-01",
    expected: "unit/line totals khớp round DB",
    type: "Positive",
    fr: "BR-01",
    test: "calculates unit discount and line totals from DB price and discount_percentage (BR-01)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Gọi quoteShipping",
    input: "subtotal_after_discount",
    condition: "BR-04",
    expected: "quoteShipping(province_id, ward_id, subtotal)",
    type: "Positive",
    fr: "BR-04",
    test: "calls quoteShipping with province_id, ward_id and subtotal_after_discount (BR-04)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Cảnh báo tồn kho",
    input: "stock=0, qty=2",
    condition: "BR-02",
    expected: "200; stock_warnings non-empty",
    type: "Positive",
    fr: "BR-02",
    test: "returns 200 with stock_warnings when stock is insufficient (BR-02)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Quantity mặc định",
    input: "item không quantity",
    condition: "§5",
    expected: "quantity=1 trong breakdown",
    type: "Positive",
    fr: "§5",
    test: "defaults quantity to 1 when omitted (§5)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "ward_id optional",
    input: "không ward_id",
    condition: "BR-03",
    expected: "200; quoteShipping ward_id null",
    type: "Positive",
    fr: "BR-03",
    test: "returns 200 when ward_id is omitted and passes null to quoteShipping (BR-03)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "PRE-01",
    expected: "401 Access token required",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 401 without bearer token (PRE-01)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "User inactive",
    input: "is_active=false",
    condition: "PRE-01",
    expected: "403 inactive",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 403 when user is inactive (PRE-01)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Không có items",
    input: "items=[]",
    condition: "PRE-02",
    expected: '400 "No items"',
    type: "Negative",
    fr: "PRE-02",
    test: 'returns 400 with message "No items" when items array is empty (PRE-02)',
    result: "Pass",
  },
  {
    id: 10,
    feature: "Thiếu province_id",
    input: "không province_id",
    condition: "PRE-03",
    expected: '400 "Missing province_id"',
    type: "Negative",
    fr: "PRE-03",
    test: 'returns 400 with message "Missing province_id" when province_id is absent (PRE-03)',
    result: "Pass",
  },
  {
    id: 11,
    feature: "Variation không tồn tại",
    input: "findByPk null",
    condition: "§5",
    expected: "400 Variation {id} not found",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when variation is not found (§5)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Read-only preview",
    input: "POST preview hợp lệ",
    condition: "§3 Out of Scope",
    expected: "không Order.create / OrderItem.create / decrement",
    type: "Positive",
    fr: "§3",
    test: "does not call Order.create, OrderItem.create or variation decrement (read-only)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_PreviewOrder")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_PreviewOrder.md | server/__tests__/orders/previewOrder.test.js"
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
    ])
  })

  sheet.columns.forEach((col) => {
    col.width = 22
  })
  sheet.getColumn(8).width = 56

  const outPath = path.join(outDir, "UnitTest_PreviewOrder.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
