/**
 * Generates docs/report/order/UnitTest_RetryVNPayPayment.xlsx
 * Usage: node scripts/generateUnitTestRetryVNPayPaymentReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Retry AWAITING_PAYMENT",
    input: "AWAITING + VNPAY pending",
    condition: "AC §12",
    expected: "200; redirect; order_id; txn_ref; expires_at ~15p",
    type: "Positive",
    fr: "AC §12",
    test: "returns 200 with redirect, order_id, txn_ref and expires_at for AWAITING_PAYMENT (AC §12)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Retry FAILED",
    input: "FAILED + VNPAY pending",
    condition: "AC §12",
    expected: "200; redirect; txn_ref mới",
    type: "Positive",
    fr: "AC §12",
    test: "returns 200 for FAILED order with VNPAY pending payment (AC §12)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Cập nhật txn_ref",
    input: "retry thành công",
    condition: "BR-02",
    expected: "payment.update({ txn_ref: orderId-timestamp })",
    type: "Positive",
    fr: "BR-02",
    test: "updates payment txn_ref with new order_id-timestamp ref (BR-02)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "getPaymentUrl",
    input: "method INTCARD",
    condition: "§5",
    expected: "getPaymentUrl(method, amount, txnRef, orderDesc)",
    type: "Positive",
    fr: "§5",
    test: "calls getPaymentUrl with method, amount, txnRef and orderDesc (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Method mặc định",
    input: "body rỗng",
    condition: "§4",
    expected: "method VNPAYQR",
    type: "Positive",
    fr: "§4",
    test: "defaults payment method to VNPAYQR when body omits method (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Không đổi order.status",
    input: "retry hợp lệ",
    condition: "BR-01",
    expected: "order.update không gọi",
    type: "Positive",
    fr: "BR-01",
    test: "does not call order.update during retry (BR-01)",
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
    feature: "Đơn không thuộc user",
    input: "Order.findOne null",
    condition: "§5",
    expected: "404 Order not found",
    type: "Negative",
    fr: "§5",
    test: "returns 404 when order is not found for user (§5)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Không phải VNPAY",
    input: "Payment.findOne null",
    condition: "§5",
    expected: "400 Payment record not found or not VNPAY",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when payment is not VNPAY (§5)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Status không eligible",
    input: "order processing",
    condition: "§5",
    expected: "400 Order not eligible for retry payment",
    type: "Negative",
    fr: "§5",
    test: "returns 400 Order not eligible when order status is processing (§5)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Payment completed",
    input: "payment_status=completed",
    condition: "§5",
    expected: "400 Order not eligible for retry payment",
    type: "Negative",
    fr: "§5",
    test: "returns 400 Order not eligible when payment is completed (§5)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_RetryVNPay")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_RetryVNPayPayment.md | server/__tests__/orders/retryVnpayPayment.test.js"
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

  const outPath = path.join(outDir, "UnitTest_RetryVNPayPayment.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
