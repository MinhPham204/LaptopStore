/**
 * Generates docs/report/payment/UnitTest_VNPayPaymentInCreateOrder.xlsx
 * Usage: node scripts/generateUnitTestVNPayPaymentInCreateOrderReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Tạo đơn VNPAY thành công",
    input: "POST /api/orders VNPAY + VNPAYQR + items",
    condition: "VNP_* env; getPaymentUrl mock; stock OK",
    expected:
      "201; AWAITING_PAYMENT; reserve_expires_at ~24h; Payment pending+txn_ref; redirect; decrement; commit",
    type: "Positive",
    fr: "AC §13",
    test: "returns 201 with redirect, AWAITING_PAYMENT, reserve_expires_at, VNPAY pending payment and commits (AC §13)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Thiếu cấu hình VNP",
    input: "POST không VNP_TMN_CODE",
    condition: "§5 step 8",
    expected: "502 VNPAY configuration error; rollback; no commit",
    type: "Negative",
    fr: "AC §13",
    test: "returns 502 VNPAY configuration error and rolls back when VNP env is missing",
    result: "Pass",
  },
  {
    id: 3,
    feature: "getPaymentUrl lỗi",
    input: "getPaymentUrl throw",
    condition: "§5 step 8",
    expected: "502; rollback; no commit",
    type: "Negative",
    fr: "AC §13",
    test: "returns 502 and rolls back when getPaymentUrl throws",
    result: "Pass",
  },
  {
    id: 4,
    feature: "payment_method không hợp lệ",
    input: "VNPAY + payment_method COD",
    condition: "§4 VALID map",
    expected: "400 Invalid payment_method; rollback",
    type: "Negative",
    fr: "§4",
    test: "returns 400 for invalid payment_method on VNPAY provider",
    result: "Pass",
  },
  {
    id: 5,
    feature: "FE redirect VNPay",
    input: "createOrder trả redirect",
    condition: "§7 BR-01",
    expected: "window.location.href = redirect; không navigate success",
    type: "Positive",
    fr: "§7 / BR-01",
    test: "sets window.location.href to redirect when createOrder returns redirect (§7)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "FE không xóa Redux cart",
    input: "cart-mode checkout VNPAY",
    condition: "§7 BR-03",
    expected: "không dispatch removeMany",
    type: "Positive",
    fr: "BR-03",
    test: "does not dispatch removeMany after VNPAY redirect (BR-03)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Return URL / paid state",
    input: "GET /api/vnpay/return",
    condition: "FR_ProcessVNPayReturn",
    expected: "Theo FR_ProcessVNPayReturn — test riêng",
    type: "N/A",
    fr: "§9",
    test: "N/A — covered by FR_ProcessVNPayReturn tests",
    result: "N/A",
  },
  {
    id: 8,
    feature: "Cron hết hạn 24h",
    input: "releaseReservations job",
    condition: "§10",
    expected: "Theo releaseReservations — test riêng",
    type: "N/A",
    fr: "§10",
    test: "N/A — covered by releaseReservations job / separate FR",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/payment")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_VNPayCreateOrder")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/payment/FR_VNPayPaymentInCreateOrder.md | vnpayPaymentInCreateOrder.test.js + CheckoutPage.vnpay.test.jsx"
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
    { width: 32 },
    { width: 40 },
    { width: 24 },
    { width: 52 },
    { width: 12 },
    { width: 18 },
    { width: 64 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_VNPayPaymentInCreateOrder.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
