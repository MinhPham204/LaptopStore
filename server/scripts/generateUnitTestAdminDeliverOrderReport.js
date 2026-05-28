/**
 * Generates docs/reports/admin/UnitTest_AdminDeliverOrder.xlsx
 * Usage: node scripts/generateUnitTestAdminDeliverOrderReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xác nhận đã giao (admin)",
    input: "POST /deliver JWT admin; status=shipping",
    condition: "§4 / BR-01",
    expected: "200 Order delivered successfully; status=delivered",
    type: "Positive",
    fr: "§4",
    test: "returns 200 and updates order to delivered for admin when status is shipping",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Xác nhận đã giao (manager)",
    input: "POST JWT manager",
    condition: "§2",
    expected: "200; update delivered",
    type: "Positive",
    fr: "§2",
    test: "returns 200 for manager when status is shipping",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Email thông báo",
    input: "shipping → delivered",
    condition: "§5",
    expected: "sendOrderUpdateEmail old/new status",
    type: "Positive",
    fr: "§5",
    test: "calls sendOrderUpdateEmail with old shipping and new delivered status",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Email lỗi không chặn",
    input: "sendOrderUpdateEmail reject",
    condition: "§5",
    expected: "vẫn 200",
    type: "Positive",
    fr: "§5",
    test: "returns 200 when sendOrderUpdateEmail rejects",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Order không tồn tại",
    input: "findByPk null",
    condition: "§4",
    expected: "404 Order not found",
    type: "Negative",
    fr: "§4",
    test: "returns 404 when order is not found",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Status processing",
    input: "status=processing",
    condition: "§5",
    expected: "400 Order must be in shipping status to deliver",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when order status is processing",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Status delivered",
    input: "status=delivered",
    condition: "§5",
    expected: "400",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when order status is delivered",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Status cancelled",
    input: "status=cancelled",
    condition: "§5",
    expected: "400",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when order status is cancelled",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Status AWAITING_PAYMENT",
    input: "status=AWAITING_PAYMENT",
    condition: "§5",
    expected: "400",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when order status is AWAITING_PAYMENT",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Thiếu JWT",
    input: "POST không Authorization",
    condition: "§4",
    expected: "401",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token",
    result: "Pass",
  },
  {
    id: 11,
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
    id: 12,
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
    id: 13,
    feature: "Lỗi DB update",
    input: "order.update throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when order.update throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminDeliverOrder")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/order/FR_AdminDeliverOrder.md | server/__tests__/admin/adminDeliverOrder.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminDeliverOrder.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
