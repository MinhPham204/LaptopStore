/**
 * Generates docs/reports/admin/UnitTest_AdminUpdateOrderStatus.xlsx
 * Usage: node scripts/generateUnitTestAdminUpdateOrderStatusReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Cập nhật status (admin)",
    input: "PUT { status: shipping } JWT admin",
    condition: "§4",
    expected: "200 Order status updated successfully; order.update",
    type: "Positive",
    fr: "§4",
    test: "returns 200 and updates order status for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Cập nhật status (manager)",
    input: "PUT JWT manager",
    condition: "§2",
    expected: "200",
    type: "Positive",
    fr: "§2",
    test: "returns 200 for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Email ORDER_STATUS",
    input: "buyer user tồn tại",
    condition: "§5 / §8",
    expected: "sendOrderUpdateEmail oldData/newData",
    type: "Positive",
    fr: "§5",
    test: "calls sendOrderUpdateEmail with ORDER_STATUS and old/new data when buyer exists",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Email fail không rollback",
    input: "sendOrderUpdateEmail reject",
    condition: "BR-02",
    expected: "vẫn 200",
    type: "Positive",
    fr: "BR-02",
    test: "returns 200 when sendOrderUpdateEmail rejects (BR-02)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Override FSM",
    input: "processing → delivered",
    condition: "BR-01",
    expected: "200 không guard transition",
    type: "Positive",
    fr: "BR-01",
    test: "allows override transition processing to delivered without guard (BR-01)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Không gửi email khi user null",
    input: "User.findByPk buyer null",
    condition: "GAP-01",
    expected: "200; sendOrderUpdateEmail NOT called",
    type: "Positive",
    fr: "GAP-01",
    test: "returns 200 but does not call sendOrderUpdateEmail when User.findByPk returns null for buyer (GAP-01)",
    result: "Pass",
  },
  {
    id: 7,
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
    id: 8,
    feature: "Thiếu JWT",
    input: "PUT không Authorization",
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
  const sheet = workbook.addWorksheet("UnitTest_AdminUpdateOrderStatus")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/order/FR_AdminUpdateOrderStatus.md | server/__tests__/admin/adminUpdateOrderStatus.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminUpdateOrderStatus.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
