/**
 * Generates docs/report/payment/UnitTest_ProcessVNPayReturn.xlsx
 * Usage: node scripts/generateUnitTestProcessVNPayReturnReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Return thành công",
    input: "GET /api/vnpay/return?vnp_*; isSuccess=true",
    condition: "AC §14; Order+Payment tồn tại",
    expected:
      "302 .../checkout/vnpay-return?status=success&orderId=; payment completed; order processing; transaction_id",
    type: "Positive",
    fr: "AC §14",
    test: "redirects success and updates payment completed and order processing when isSuccess is true",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Idempotent completed",
    input: "payment_status=completed",
    condition: "BR-04",
    expected: "skip save; vẫn redirect success",
    type: "Positive",
    fr: "BR-04",
    test: "skips DB update but still redirects success when payment is already completed",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Thiếu order/payment",
    input: "isSuccess=true; Order/Payment null",
    condition: "GAP-05",
    expected: "redirect success; không cập nhật DB",
    type: "Edge",
    fr: "GAP-05",
    test: "redirects success without DB update when order or payment is missing (GAP-05)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Return thất bại",
    input: "isSuccess=false; vnp_ResponseCode=24",
    condition: "§7 BR-08",
    expected: "payment failed; redirect status=failed",
    type: "Positive",
    fr: "§7 / BR-08",
    test: "redirects failed and sets payment failed when isSuccess is false",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Hash không hợp lệ",
    input: "verifyReturnUrl isSuccess=false",
    condition: "§7 hash invalid",
    expected: "payment failed; redirect failed",
    type: "Negative",
    fr: "§7",
    test: "treats invalid secure hash as failure (isSuccess false from verifyReturnUrl)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "txnRef rỗng",
    input: "vnp_Params không có vnp_TxnRef",
    condition: "§9",
    expected: "redirect failed&orderId=unknown",
    type: "Negative",
    fr: "§9",
    test: "redirects failed with orderId=unknown when txnRef is empty",
    result: "Pass",
  },
  {
    id: 7,
    feature: "verifyReturnUrl throw",
    input: "verifyReturnUrl throws",
    condition: "§8",
    expected: "302 /orders?error=unknown",
    type: "Negative",
    fr: "§8",
    test: "redirects to orders with error=unknown when verifyReturnUrl throws",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Lỗi DB",
    input: "Order.findByPk throws",
    condition: "§8 catch",
    expected: "302 /orders?error=unknown",
    type: "Negative",
    fr: "§8",
    test: "redirects to orders with error=unknown when Order.findByPk throws",
    result: "Pass",
  },
  {
    id: 9,
    feature: "verifyReturnUrl hash + code 00",
    input: "params ký HMAC đúng",
    condition: "BR-01",
    expected: "isSuccess=true; vnp_Params không có SecureHash",
    type: "Positive",
    fr: "BR-01",
    test: "returns isSuccess true when hash matches and vnp_ResponseCode is 00",
    result: "Pass",
  },
  {
    id: 10,
    feature: "verifyReturnUrl code khác 00",
    input: "vnp_ResponseCode=24",
    condition: "BR-01",
    expected: "isSuccess=false",
    type: "Negative",
    fr: "BR-01",
    test: "returns isSuccess false when vnp_ResponseCode is not 00",
    result: "Pass",
  },
  {
    id: 11,
    feature: "verifyReturnUrl hash sai",
    input: "vnp_SecureHash invalid",
    condition: "§7",
    expected: "isSuccess=false",
    type: "Negative",
    fr: "§7",
    test: "returns isSuccess false when vnp_SecureHash does not match",
    result: "Pass",
  },
  {
    id: 12,
    feature: "SecureHashType bỏ qua khi ký",
    input: "có vnp_SecureHashType",
    condition: "§4",
    expected: "isSuccess=true khi hash đúng",
    type: "Edge",
    fr: "§4",
    test: "ignores vnp_SecureHashType when verifying signature",
    result: "Pass",
  },
  {
    id: 13,
    feature: "FE VnpayReturn page",
    input: "React sau redirect",
    condition: "FR_VNPayReturnPage",
    expected: "Theo FR_VNPayReturnPage — không test server",
    type: "N/A",
    fr: "FR_VNPayReturnPage",
    test: "N/A — frontend VnpayReturn (FR_VNPayReturnPage)",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/payment")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ProcessVNPayReturn")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/payment/FR_ProcessVNPayReturn.md | vnpayReturn.test.js + verifyReturnUrl.test.js"
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

  const outPath = path.join(outDir, "UnitTest_ProcessVNPayReturn.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
