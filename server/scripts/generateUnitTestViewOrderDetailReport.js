/**
 * Generates docs/report/order/UnitTest_ViewOrderDetail.xlsx
 * Usage: node scripts/generateUnitTestViewOrderDetailReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Chi tiết đơn đầy đủ",
    input: "GET /api/orders/:id Bearer JWT",
    condition: "AC §10",
    expected: "200; body { order }",
    type: "Positive",
    fr: "AC §10",
    test: "returns 200 with full order payload (AC §10)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Lọc theo chủ đơn",
    input: "order_id + user_id",
    condition: "BR-01",
    expected: "findOne where order_id và user_id",
    type: "Positive",
    fr: "BR-01",
    test: "queries Order.findOne with order_id and user_id (BR-01)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Include associations",
    input: "GET detail",
    condition: "BR-03, BR-04",
    expected: "items→variation→product; payment",
    type: "Positive",
    fr: "BR-03 / BR-04",
    test: "includes items with variation and product plus payment (BR-03, BR-04)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Nested items response",
    input: "order có items",
    condition: "§4",
    expected: "items[].variation.product trong JSON",
    type: "Positive",
    fr: "§4",
    test: "returns nested items with variation and product in response (§4)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "reserve_expires_at và note",
    input: "mock có field",
    condition: "§4",
    expected: "note và reserve_expires_at trong response",
    type: "Positive",
    fr: "§4",
    test: "returns reserve_expires_at and note when present on order (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "PRE-01",
    expected: "401",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 401 without bearer token (PRE-01)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "User inactive",
    input: "is_active=false",
    condition: "PRE-01",
    expected: "403",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 403 when user is inactive (PRE-01)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Order not found",
    input: "findOne null",
    condition: "AC §10",
    expected: "404 Order not found",
    type: "Negative",
    fr: "AC §10",
    test: "returns 404 when order is not found for user (AC §10)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewOrderDetail")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_ViewOrderDetail.md | server/__tests__/orders/viewOrderDetail.test.js"
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
  sheet.getColumn(8).width = 52

  const outPath = path.join(outDir, "UnitTest_ViewOrderDetail.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
