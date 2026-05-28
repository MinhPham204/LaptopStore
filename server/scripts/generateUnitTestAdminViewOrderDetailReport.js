/**
 * Generates docs/reports/admin/UnitTest_AdminViewOrderDetail.xlsx
 * Usage: node scripts/generateUnitTestAdminViewOrderDetailReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Chi tiết đơn (admin)",
    input: "GET JWT admin",
    condition: "§4 / AC",
    expected: "200 body.order",
    type: "Positive",
    fr: "§4",
    test: "returns 200 with body.order for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Chi tiết đơn (manager)",
    input: "GET JWT manager",
    condition: "§2",
    expected: "200 body.order",
    type: "Positive",
    fr: "§2",
    test: "returns 200 with body.order for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Include Sequelize",
    input: "GET hợp lệ",
    condition: "§5",
    expected: "items→variation→product, payment, user attributes",
    type: "Positive",
    fr: "§5",
    test: "queries Order.findOne with items, payment, and user includes per FR §5",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Payload nested",
    input: "mock order đủ quan hệ",
    condition: "§4",
    expected: "items, payment, user trong response",
    type: "Positive",
    fr: "§4",
    test: "returns nested items, payment, and user in response (§4)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Không lọc ownership",
    input: "GET admin",
    condition: "BR-01",
    expected: "where chỉ order_id",
    type: "Positive",
    fr: "BR-01",
    test: "does not filter by user_id — admin views any order (BR-01)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Order không tồn tại",
    input: "findOne null",
    condition: "§4",
    expected: "404 Order not found",
    type: "Negative",
    fr: "§4",
    test: "returns 404 when order is not found",
    result: "Pass",
  },
  {
    id: 7,
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
    id: 8,
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
    id: 9,
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
    id: 10,
    feature: "Lỗi DB",
    input: "findOne throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when Order.findOne throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminViewOrderDetail")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/order/FR_AdminViewOrderDetail.md | server/__tests__/admin/adminViewOrderDetail.test.js"
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
    { width: 62 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_AdminViewOrderDetail.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
