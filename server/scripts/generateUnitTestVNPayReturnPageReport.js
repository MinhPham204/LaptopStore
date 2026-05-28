/**
 * Generates docs/report/payment/UnitTest_VNPayReturnPage.xlsx
 * Usage: node scripts/generateUnitTestVNPayReturnPageReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Thanh toán thành công",
    input: "?status=success&orderId=42",
    condition: "§6 success branch",
    expected: "navigate /orders?tab=to_ship replace true",
    type: "Positive",
    fr: "AC §12",
    test: "navigates to /orders?tab=to_ship with replace when status=success",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Thanh toán thất bại",
    input: "?status=failed&orderId=42",
    condition: "§6 failed branch",
    expected: "navigate /orders?tab=failed replace true",
    type: "Positive",
    fr: "AC §12",
    test: "navigates to /orders?tab=failed with replace when status=failed",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Thiếu status",
    input: "?orderId=42 (không status)",
    condition: "§6 fallback; fake timers 5s",
    expected: "countdown UI; sau 5s navigate /orders replace true",
    type: "Positive",
    fr: "AC §12 / §6",
    test: "navigates to /orders with replace after 5s when status is missing",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Status không hợp lệ",
    input: "?status=cancelled&orderId=99",
    condition: "§6 fallback countdown",
    expected: "không tab to_ship/failed; sau 5s /orders",
    type: "Negative",
    fr: "§6",
    test: "uses countdown fallback for unknown status and does not call API",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Hiển thị query debug",
    input: "?status=success&orderId=ORD-42",
    condition: "BR-02 UI",
    expected: "render OrderId, Status; không API",
    type: "Positive",
    fr: "BR-02",
    test: "displays orderId and status from query without API calls",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Không gọi API",
    input: "mọi case trên",
    condition: "§3 Out of Scope",
    expected: "fetch/API không được gọi",
    type: "Negative",
    fr: "AC §12",
    test: "(asserted in each test via expectNoApiCalls)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "BE verify + DB update",
    input: "GET /api/vnpay/return",
    condition: "FR_ProcessVNPayReturn",
    expected: "Theo FR_ProcessVNPayReturn — test server riêng",
    type: "N/A",
    fr: "FR_ProcessVNPayReturn",
    test: "N/A — vnpayReturn DB logic (FR_ProcessVNPayReturn)",
    result: "N/A",
  },
  {
    id: 8,
    feature: "BE error=unknown",
    input: "/orders?error=unknown",
    condition: "GAP-07",
    expected: "Không qua VnpayReturn — không test component",
    type: "N/A",
    fr: "GAP-07",
    test: "N/A — BE catch redirects to /orders?error=unknown",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/payment")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_VNPayReturnPage")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/payment/FR_VNPayReturnPage.md | client/app/pages/checkout/VnpayReturn.test.jsx"
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
    { width: 28 },
    { width: 48 },
    { width: 12 },
    { width: 22 },
    { width: 56 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_VNPayReturnPage.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
