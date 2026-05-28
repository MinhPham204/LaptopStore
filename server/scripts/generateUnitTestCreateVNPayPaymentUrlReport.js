/**
 * Generates docs/report/payment/UnitTest_CreateVNPayPaymentUrl.xlsx
 * Usage: node scripts/generateUnitTestCreateVNPayPaymentUrlReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Sinh URL VNPay hợp lệ",
    input: "getPaymentUrl(amount, txnRef, orderDesc, ipAddr)",
    condition: "VNPAY_* env set; AC §5",
    expected:
      "URL có vnp_SecureHash, vnp_TxnRef, vnp_Amount=amount×100, vnp_ReturnUrl /api/vnpay/return, vnp_Command=pay",
    type: "Positive",
    fr: "AC §5",
    test: "builds payment URL with vnp_SecureHash, TxnRef, Amount×100, ReturnUrl and Command pay",
    result: "Pass",
  },
  {
    id: 2,
    feature: "method không ép BankCode",
    input: "method=VNBANK|VNPAYQR|INTCARD",
    condition: "GAP-02; bankCode block commented",
    expected: "URL không có vnp_BankCode",
    type: "Edge",
    fr: "GAP-02",
    test: "does not add vnp_BankCode when method is VNBANK, VNPAYQR or INTCARD",
    result: "Pass",
  },
  {
    id: 3,
    feature: "ENV VNP_* vs VNPAY_*",
    input: "chỉ set VNP_TMN_CODE; sau đó VNPAY_TMN_CODE",
    condition: "GAP-01 §4",
    expected: "Service dùng default/VNPAY_*; không đọc VNP_TMN_CODE",
    type: "Edge",
    fr: "GAP-01 / §4",
    test: "reads VNPAY_* env only; VNP_* alone does not override service config (GAP-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "IP mặc định",
    input: "getPaymentUrl không truyền ipAddr",
    condition: "§5 vnp_IpAddr",
    expected: "vnp_IpAddr=127.0.0.1",
    type: "Edge",
    fr: "§5",
    test: "defaults vnp_IpAddr to 127.0.0.1 when ipAddr is omitted",
    result: "Pass",
  },
  {
    id: 5,
    feature: "POST create_payment_url thành công",
    input: 'POST { orderId, amount } không Authorization',
    condition: "AC §6 standalone API",
    expected: "200 { url }; txnRef orderId-timestamp; gọi getPaymentUrl",
    type: "Positive",
    fr: "AC §6",
    test: "returns 200 with url and txnRef orderId-timestamp without Authorization header",
    result: "Pass",
  },
  {
    id: 6,
    feature: "IP từ x-forwarded-for",
    input: "Header x-forwarded-for",
    condition: "createPayment ipAddr",
    expected: "ipAddr = giá trị đầu tiên trước dấu phẩy",
    type: "Positive",
    fr: "§6",
    test: "passes first x-forwarded-for value as ipAddr",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Thiếu orderId",
    input: "POST chỉ amount",
    condition: "§6 Errors",
    expected: '400 "Thiếu orderId hoặc amount"',
    type: "Negative",
    fr: "§6",
    test: 'returns 400 "Thiếu orderId hoặc amount" when orderId is missing',
    result: "Pass",
  },
  {
    id: 8,
    feature: "Thiếu amount",
    input: "POST chỉ orderId",
    condition: "§6 Errors",
    expected: '400 "Thiếu orderId hoặc amount"',
    type: "Negative",
    fr: "§6",
    test: 'returns 400 "Thiếu orderId hoặc amount" when amount is missing',
    result: "Pass",
  },
  {
    id: 9,
    feature: "Lỗi sinh URL",
    input: "getPaymentUrl throw",
    condition: "§6 Errors",
    expected: '500 "Lỗi tạo link thanh toán"',
    type: "Negative",
    fr: "§6",
    test: 'returns 500 "Lỗi tạo link thanh toán" when getPaymentUrl throws',
    result: "Pass",
  },
  {
    id: 10,
    feature: "URL trong createOrder / retry / changePM",
    input: "orderController flows",
    condition: "§7 Related FRs",
    expected: "Theo FR_VNPayPaymentInCreateOrder, FR_RetryVNPayPayment, FR_ChangePaymentMethod",
    type: "N/A",
    fr: "§7",
    test: "N/A — covered by separate FRs (createOrder / retry / changePM)",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/payment")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_CreateVNPayPaymentUrl")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/payment/FR_CreateVNPayPaymentUrl.md | vnpayService.getPaymentUrl.test.js + createVNPayPaymentUrl.test.js"
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

  const outPath = path.join(outDir, "UnitTest_CreateVNPayPaymentUrl.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
