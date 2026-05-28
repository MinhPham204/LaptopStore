/**
 * Generates docs/report/order/UnitTest_ChangePaymentMethod.xlsx
 * Usage: node scripts/generateUnitTestChangePaymentMethodReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "COD → VNPAY",
    input: "provider VNPAY, method VNPAYQR",
    condition: "AC1",
    expected: "200; AWAITING_PAYMENT; redirect URL; commit",
    type: "Positive",
    fr: "AC1",
    test: "changes COD to VNPAY with AWAITING_PAYMENT and redirect (AC1)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "VNPAY → COD",
    input: "provider COD, method COD",
    condition: "§6",
    expected: "200; processing; redirect null",
    type: "Positive",
    fr: "§6",
    test: "changes VNPAY to COD with processing status and null redirect (§6)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "getPaymentUrl args",
    input: "COD→VNPAY",
    condition: "§6",
    expected: "txnRef, amount, orderDesc đúng",
    type: "Positive",
    fr: "§6",
    test: "changes COD to VNPAY with AWAITING_PAYMENT and redirect (AC1)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Order không tồn tại",
    input: "user khác",
    condition: "§5",
    expected: "404 Order not found",
    type: "Negative",
    fr: "§5",
    test: "returns 404 when order is not found (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Trạng thái shipping",
    input: "status=shipping",
    condition: "§6",
    expected: "400 Cannot change payment",
    type: "Negative",
    fr: "§6",
    test: "returns 400 when order status is shipping (§6)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Trạng thái delivered",
    input: "status=delivered",
    condition: "§6",
    expected: "400 Cannot change payment",
    type: "Negative",
    fr: "§6",
    test: "returns 400 when order status is delivered (§6)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Trạng thái cancelled",
    input: "status=cancelled",
    condition: "§6",
    expected: "400 Cannot change payment",
    type: "Negative",
    fr: "§6",
    test: "returns 400 when order status is cancelled (§6)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Payment đã completed",
    input: "payment_status=completed",
    condition: "§5",
    expected: "400 Payment already completed",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when payment is already completed (§5)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Không có payment",
    input: "Payment.findOne null",
    condition: "§5",
    expected: "400 Payment record not found",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when payment record is missing (§5)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Provider không hỗ trợ",
    input: "provider PAYPAL",
    condition: "§5",
    expected: "400 Unsupported provider",
    type: "Negative",
    fr: "§5",
    test: "returns 400 for unsupported provider (§5)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Method không hợp lệ",
    input: "VNPAY + NOT_A_METHOD",
    condition: "§5",
    expected: "400 Invalid method",
    type: "Negative",
    fr: "§5",
    test: "returns 400 for invalid VNPAY method (§5)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Thiếu cấu hình VNPAY",
    input: "env VNP_* missing",
    condition: "§5",
    expected: "502; rollback; không commit",
    type: "Negative",
    fr: "§5",
    test: "returns 502 and rolls back when VNPAY env is missing (§5)",
    result: "Pass",
  },
  {
    id: 13,
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
    id: 14,
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
    id: 15,
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
    id: 16,
    feature: "FE auto redirect / invalidate",
    input: "useChangePaymentMethod",
    condition: "AC2–AC4 FE",
    expected: "N/A — client hook",
    type: "Ref",
    fr: "AC2–AC4",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ChangePaymentMethod")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_ChangePaymentMethod.md | server/__tests__/orders/changePaymentMethod.test.js"
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
    { width: 14 },
    { width: 68 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_ChangePaymentMethod.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
