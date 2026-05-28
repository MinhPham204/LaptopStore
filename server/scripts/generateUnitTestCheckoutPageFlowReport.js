/**
 * Generates docs/report/order/UnitTest_CheckoutPageFlow.xlsx
 * Usage: node scripts/generateUnitTestCheckoutPageFlowReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Preview không gọi khi items rỗng",
    input: "viewItems=[]",
    condition: "§7",
    expected: "api.post không gọi",
    type: "Negative",
    fr: "§7",
    test: "does not call preview API when viewItems is empty (§7)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Preview không gọi khi thiếu tỉnh",
    input: "provinceId rỗng",
    condition: "§7",
    expected: "api.post không gọi",
    type: "Negative",
    fr: "§7",
    test: "does not call preview API when provinceId is missing (§7)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Preview debounce 500ms",
    input: "provinceId + items",
    condition: "§7",
    expected: "POST /orders/preview sau 500ms",
    type: "Positive",
    fr: "§7",
    test: "calls POST /orders/preview after 500ms debounce (§7)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Debounce đổi tỉnh",
    input: "đổi province nhanh",
    condition: "§7",
    expected: "1 lần gọi; province_id cuối",
    type: "Positive",
    fr: "§7",
    test: "debounces rapid province changes to a single preview call (§7)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Preview lỗi API",
    input: "api.post reject",
    condition: "§7",
    expected: "error state; data null",
    type: "Negative",
    fr: "§7",
    test: "sets error state when preview API fails (§7)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Guard không intent",
    input: "state null",
    condition: "§4",
    expected: "navigate /cart replace",
    type: "Negative",
    fr: "§4",
    test: "redirects to /cart when checkout intent is missing (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Guard items rỗng",
    input: "items=[]",
    condition: "§4",
    expected: "navigate /cart",
    type: "Negative",
    fr: "§4",
    test: "redirects to /cart when intent items array is empty (§4)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "COD cart success",
    input: "mode cart + COD submit",
    condition: "§9",
    expected: "success + removeMany; items từ intent",
    type: "Positive",
    fr: "§9",
    test: "navigates to success and dispatches removeMany for COD cart checkout (§9)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "COD buy_now",
    input: "mode buy_now",
    condition: "§9",
    expected: "success; không removeMany",
    type: "Positive",
    fr: "§9",
    test: "does not dispatch removeMany for buy_now COD checkout (§9)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "VNPay redirect",
    input: "res.redirect",
    condition: "§9",
    expected: "window.location.href; không success navigate",
    type: "Positive",
    fr: "§9",
    test: "assigns window.location.href when createOrder returns redirect (§9)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Submit cần xác nhận map",
    input: "chưa Xác nhận vị trí",
    condition: "§6",
    expected: "nút Đặt hàng disabled",
    type: "Negative",
    fr: "§6",
    test: "keeps submit disabled until location is confirmed (§6)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Create lỗi",
    input: "mutateAsync reject",
    condition: "GAP-03",
    expected: "không navigate /checkout/success",
    type: "Negative",
    fr: "GAP-03",
    test: "does not navigate to success when createOrder fails (GAP-03)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "POST /orders/preview BE",
    input: "previewOrder API",
    condition: "FR_PreviewOrder",
    expected: "N/A — server tests",
    type: "Ref",
    fr: "FR_PreviewOrder",
    test: "—",
    result: "N/A",
  },
  {
    id: 14,
    feature: "POST /orders createOrder BE",
    input: "createOrder API",
    condition: "FR_CreateOrder",
    expected: "N/A — server tests",
    type: "Ref",
    fr: "FR_CreateOrder",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_CheckoutPageFlow")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_CheckoutPageFlow.md | useOrderPreview.test.js | CheckoutPage.checkoutFlow.test.jsx"
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

  const outPath = path.join(outDir, "UnitTest_CheckoutPageFlow.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
