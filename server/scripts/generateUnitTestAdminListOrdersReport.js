/**
 * Generates docs/reports/admin/UnitTest_AdminListOrders.xlsx
 * Usage: node scripts/generateUnitTestAdminListOrdersReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách đơn (admin)",
    input: "GET /api/admin/orders JWT admin",
    condition: "§4 / AC",
    expected: "200 orders + pagination",
    type: "Positive",
    fr: "§4",
    test: "returns 200 with orders and pagination for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Danh sách đơn (manager)",
    input: "GET JWT manager",
    condition: "§2",
    expected: "200 orders + pagination",
    type: "Positive",
    fr: "§2",
    test: "returns 200 with orders and pagination for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Tab Tất cả",
    input: "không query status",
    condition: "§5",
    expected: "where không có status",
    type: "Positive",
    fr: "§5",
    test: "uses empty where when status query is omitted",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Lọc status",
    input: "?status=processing",
    condition: "§5",
    expected: "where.status=processing",
    type: "Positive",
    fr: "§5",
    test: "filters by status=processing when query param is set",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Phân trang",
    input: "page=2&limit=10",
    condition: "§5",
    expected: "limit/offset/totalPages đúng",
    type: "Positive",
    fr: "§5",
    test: "applies page, limit, offset and computes totalPages",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Include user/payment",
    input: "spy findAndCountAll",
    condition: "§5",
    expected: "include user+payment attributes; order created_at DESC",
    type: "Positive",
    fr: "§5",
    test: "includes user and payment with correct attributes and sorts by created_at DESC",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Không lọc payment_status",
    input: "?status=cancelled",
    condition: "BR-01",
    expected: "where không có payment_status",
    type: "Positive",
    fr: "BR-01",
    test: "does not filter by payment_status in where clause (BR-01)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Thiếu JWT",
    input: "GET không Authorization",
    condition: "§4",
    expected: "401",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Role customer",
    input: "JWT customer",
    condition: "§4",
    expected: "403",
    type: "Negative",
    fr: "§4",
    test: "returns 403 for customer role",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Role staff",
    input: "JWT staff",
    condition: "§4",
    expected: "403",
    type: "Negative",
    fr: "§4",
    test: "returns 403 for staff role",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Lỗi DB",
    input: "findAndCountAll throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when Order.findAndCountAll throws",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Ship / deliver / refund / detail",
    input: "endpoints khác",
    condition: "FR riêng",
    expected: "N/A — test file riêng",
    type: "N/A",
    fr: "§9",
    test: "N/A — ship/deliver/refund/detail covered by separate FRs",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminListOrders")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/order/FR_AdminListOrders.md | server/__tests__/admin/adminListOrders.test.js"
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

  sheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 36 },
    { width: 22 },
    { width: 48 },
    { width: 12 },
    { width: 18 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_AdminListOrders.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
