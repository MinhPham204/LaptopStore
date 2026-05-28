/**
 * Generates docs/report/order/UnitTest_ViewOrderDetailSlim.xlsx
 * Usage: node scripts/generateUnitTestViewOrderDetailSlimReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Slim detail thành công",
    input: "GET /api/orders/:id/slim",
    condition: "AC §10, §4",
    expected: "200; order + items + payment chuẩn hóa",
    type: "Positive",
    fr: "AC §10 / §4",
    test: "returns 200 with normalized order, items and payment (AC §10, §4)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Number amounts và geo",
    input: "DECIMAL string + geo string",
    condition: "§5",
    expected: "final_amount, payment.amount, geo_lat/lng là number",
    type: "Positive",
    fr: "§5",
    test: "coerces decimal strings and geo coordinates to numbers (§5)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Geo null",
    input: "geo_lat/lng null",
    condition: "§5",
    expected: "geo_lat/geo_lng null",
    type: "Positive",
    fr: "§5",
    test: "returns null geo when geo_lat and geo_lng are missing (§5)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Thumbnail ưu tiên",
    input: "images[0] và thumbnail_url",
    condition: "§5",
    expected: "image_url trước; fallback thumbnail_url",
    type: "Positive",
    fr: "§5",
    test: "prefers product.images[0].image_url over thumbnail_url (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Lọc chủ đơn",
    input: "order_id + user_id",
    condition: "BR-01",
    expected: "findOne where đúng user",
    type: "Positive",
    fr: "BR-01",
    test: "queries Order.findOne with order_id and user_id (BR-01)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Sort items ASC",
    input: "findOne options",
    condition: "§3",
    expected: "order order_item_id ASC",
    type: "Positive",
    fr: "§3",
    test: "requests items ordered by order_item_id ASC (§3)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "GAP-01 reserve_expires_at",
    input: "DB có reserve_expires_at",
    condition: "GAP-01",
    expected: "response không có reserve_expires_at/note",
    type: "Positive",
    fr: "GAP-01",
    test: "does not include reserve_expires_at in slim order payload (GAP-01)",
    result: "Pass",
  },
  {
    id: 8,
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
    id: 9,
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
    id: 10,
    feature: "Order not found",
    input: "findOne null",
    condition: "§4",
    expected: "404 Order not found",
    type: "Negative",
    fr: "§4",
    test: "returns 404 when order is not found (§4)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewOrderDetailSlim")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_ViewOrderDetailSlim.md | server/__tests__/orders/viewOrderDetailSlim.test.js"
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
  sheet.getColumn(8).width = 54

  const outPath = path.join(outDir, "UnitTest_ViewOrderDetailSlim.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
