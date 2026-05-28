/**
 * Generates docs/report/order/UnitTest_CheckoutSuccessPage.xlsx
 * Usage: node scripts/generateUnitTestCheckoutSuccessPageReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Hiển thị COD success",
    input: "state order_code + customer_name + COD",
    condition: "AC1",
    expected: "tiêu đề, mã đơn, tên, COD copy, links /orders và /",
    type: "Positive",
    fr: "AC1",
    test: "renders COD success content with order code, customer name, and links (AC1)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Hiển thị VNPAY copy",
    input: "payment_provider VNPAY",
    condition: "§7",
    expected: "VNPay label + bullets thanh toán",
    type: "Positive",
    fr: "§7",
    test: "renders VNPay payment copy and bullets when payment_provider is VNPAY (§7)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Guard state null",
    input: "location.state null",
    condition: "AC2, BR-01",
    expected: 'navigate("/", replace)',
    type: "Negative",
    fr: "AC2 / BR-01",
    test: 'redirects to home when location state is null (AC2, BR-01)',
    result: "Pass",
  },
  {
    id: 4,
    feature: "Guard state undefined",
    input: "location.state undefined",
    condition: "BR-01",
    expected: 'navigate("/", replace)',
    type: "Negative",
    fr: "BR-01",
    test: 'redirects to home when location state is undefined (AC2, BR-01)',
    result: "Pass",
  },
  {
    id: 5,
    feature: "Thiếu order_code",
    input: "state không có order_code",
    condition: "§6",
    expected: 'redirect /',
    type: "Negative",
    fr: "§6",
    test: "redirects when order_code is missing (§6)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Thiếu customer_name",
    input: "state không có customer_name",
    condition: "§6",
    expected: 'redirect /',
    type: "Negative",
    fr: "§6",
    test: "redirects when customer_name is missing (§6)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Backend API",
    input: "GET /orders",
    condition: "Out of scope",
    expected: "N/A — FE only",
    type: "Ref",
    fr: "Out of scope",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_CheckoutSuccessPage")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_CheckoutSuccessPage.md | client/app/pages/CheckoutSuccessPage.test.jsx"
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
    { width: 62 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_CheckoutSuccessPage.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
