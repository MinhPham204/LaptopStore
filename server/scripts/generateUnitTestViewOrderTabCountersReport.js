/**
 * Generates docs/report/order/UnitTest_ViewOrderTabCounters.xlsx
 * Usage: node scripts/generateUnitTestViewOrderTabCountersReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Đếm tab V2 đầy đủ",
    input: "12 đơn fixture đủ trạng thái",
    condition: "§5",
    expected: "JSON counters khớp V2",
    type: "Positive",
    fr: "§5",
    test: "aggregates all tab counters per getOrderCountersV2 rules (§5)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "to_ship <= processing",
    input: "fixture mixed",
    condition: "AC §12",
    expected: "to_ship <= processing",
    type: "Positive",
    fr: "AC §12",
    test: "ensures to_ship count is less than or equal to processing (AC §12)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "awaiting_payment",
    input: "AWAITING VNPAY vs COD",
    condition: "§5",
    expected: "chỉ VNPAY pending",
    type: "Positive",
    fr: "§5",
    test: "counts awaiting_payment only for AWAITING_PAYMENT with VNPAY pending (§5)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "to_ship COD",
    input: "processing + COD pending",
    condition: "§5",
    expected: "processing=1; to_ship=1",
    type: "Positive",
    fr: "§5",
    test: "increments processing and to_ship for COD processing with pending payment (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "to_ship VNPAY completed",
    input: "processing + VNPAY completed",
    condition: "§5",
    expected: "processing=1; to_ship=1",
    type: "Positive",
    fr: "§5",
    test: "increments processing and to_ship for VNPAY processing with completed payment (§5)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "V2 không to_ship pending",
    input: "processing + VNPAY pending",
    condition: "§5 V2",
    expected: "processing=1; to_ship=0",
    type: "Positive",
    fr: "§5",
    test: "increments processing but not to_ship for VNPAY processing with pending payment (§5 V2)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "shipping",
    input: "3 shipping variants",
    condition: "§5",
    expected: "shipping=2",
    type: "Positive",
    fr: "§5",
    test: "counts shipping only when payment matches COD pending or VNPAY completed (§5)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "delivered",
    input: "delivered completed vs pending",
    condition: "§5",
    expected: "delivered=1",
    type: "Positive",
    fr: "§5",
    test: "counts delivered only when payment_status is completed (§5)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "cancelled và failed",
    input: "cancelled + FAILED",
    condition: "§5",
    expected: "cancelled=2; failed=1",
    type: "Positive",
    fr: "§5",
    test: "counts cancelled for cancelled and FAILED, and failed only for FAILED (§5)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "findAll query",
    input: "GET counters",
    condition: "§3",
    expected: "where user_id; attributes; payment include",
    type: "Positive",
    fr: "§3",
    test: "loads orders with user_id filter, minimal attributes and payment include (§3)",
    result: "Pass",
  },
  {
    id: 11,
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
    id: 12,
    feature: "User inactive",
    input: "is_active=false",
    condition: "PRE-01",
    expected: "403",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 403 when user is inactive (PRE-01)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewOrderTabCounters")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_ViewOrderTabCounters.md | server/__tests__/orders/viewOrderTabCounters.test.js"
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
  sheet.getColumn(8).width = 58

  const outPath = path.join(outDir, "UnitTest_ViewOrderTabCounters.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
