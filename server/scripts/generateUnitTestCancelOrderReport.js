/**
 * Generates docs/report/order/UnitTest_CancelOrder.xlsx
 * Usage: node scripts/generateUnitTestCancelOrderReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Hủy VNPay chờ thanh toán",
    input: "AWAITING_PAYMENT + VNPAY pending",
    condition: "AC1, §4",
    expected: "200; payment failed; increment stock",
    type: "Positive",
    fr: "AC1 / §4",
    test: "cancels VNPAY AWAITING_PAYMENT with payment failed and restores stock (AC1, §4)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Hủy COD chờ giao",
    input: "processing + COD pending",
    condition: "AC2, §4",
    expected: "200; cancelled; payment failed; increment stock",
    type: "Positive",
    fr: "AC2 / §4",
    test: "cancels COD processing order with payment failed and restores stock (AC2, §4)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Hủy VNPay đã trả",
    input: "processing + VNPAY completed",
    condition: "AC3, §4",
    expected: "200; payment pending; increment stock",
    type: "Positive",
    fr: "AC3 / §4",
    test: "cancels VNPAY processing+completed with payment pending and restores stock (AC3, §4)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Ghi chú appendNote",
    input: 'reason: "Đổi ý"',
    condition: "§6",
    expected: "note có [Cancel @] + reason",
    type: "Positive",
    fr: "§6",
    test: "appends cancel reason to order note via appendNote (§6)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Cắt reason 500 ký tự",
    input: "reason 600 chars",
    condition: "§5",
    expected: "note chỉ chứa 500 ký tự reason",
    type: "Positive",
    fr: "§5",
    test: "slices cancel reason to 500 characters (§5)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Đơn không thuộc user",
    input: "user_id khác",
    condition: "AC5",
    expected: "404 Order not found",
    type: "Negative",
    fr: "AC5",
    test: "returns 404 when order is not found for user (AC5)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Đang giao hàng",
    input: "status=shipping",
    condition: "AC4",
    expected: "400 cannot be cancelled",
    type: "Negative",
    fr: "AC4",
    test: "returns 400 when order is shipping (AC4)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Đã giao",
    input: "status=delivered",
    condition: "AC4",
    expected: "400 cannot be cancelled",
    type: "Negative",
    fr: "AC4",
    test: "returns 400 when order is delivered (AC4)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Đã hủy",
    input: "status=cancelled",
    condition: "AC4",
    expected: "400 cannot be cancelled",
    type: "Negative",
    fr: "AC4",
    test: "returns 400 when order is already cancelled (AC4)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Combo VNPay không hợp lệ",
    input: "processing + VNPAY pending",
    condition: "§4",
    expected: "400 cannot be cancelled",
    type: "Negative",
    fr: "§4",
    test: "returns 400 for VNPAY processing with pending payment (§4)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "BR-04",
    expected: "401 Access token required",
    type: "Negative",
    fr: "BR-04",
    test: "returns 401 without bearer token (BR-04)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "User inactive",
    input: "is_active=false",
    condition: "BR-04",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "BR-04",
    test: "returns 403 when user is inactive (BR-04)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Lỗi DB",
    input: "Order.findOne throw",
    condition: "Error",
    expected: "500; rollback",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Order.findOne throws",
    result: "Pass",
  },
  {
    id: 14,
    feature: "canCancel FE",
    input: "order fixtures",
    condition: "AC6",
    expected: "true/false khớp §4",
    type: "Positive",
    fr: "AC6",
    test: "canCancel mirror cases (AC6)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_CancelOrder")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_CancelOrder.md | server/__tests__/orders/cancelOrder.test.js"
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
    { width: 30 },
    { width: 36 },
    { width: 22 },
    { width: 48 },
    { width: 12 },
    { width: 18 },
    { width: 68 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_CancelOrder.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
