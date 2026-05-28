/**
 * Generates docs/report/order/UnitTest_ReserveInventoryOnOrder.xlsx
 * Usage: node scripts/generateUnitTestReserveInventoryOnOrderReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Reserve COD — decrement + lock",
    input: "POST /api/orders COD",
    condition: "BR-01, BR-03",
    expected: "findOne LOCK UPDATE skipLocked; decrement by qty; OrderItem.create",
    type: "Positive",
    fr: "BR-01 / BR-03",
    test: "decrements stock with LOCK UPDATE and skipLocked on reserve for COD (BR-01, BR-03)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Soft check — không reserve",
    input: "stock < qty trước lock",
    condition: "§4",
    expected: "400 Insufficient stock; không decrement/findOne reserve",
    type: "Negative",
    fr: "§4",
    test: "does not decrement or reserve when soft stock check fails (§4)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "VNPay reserve_expires_at",
    input: "POST VNPAY",
    condition: "§4",
    expected: "reserve_expires_at ~24h; decrement stock",
    type: "Positive",
    fr: "§4",
    test: "sets reserve_expires_at ~24h for VNPAY and decrements stock (§4)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "COD không TTL",
    input: "POST COD",
    condition: "§4",
    expected: "reserve_expires_at null",
    type: "Positive",
    fr: "§4",
    test: "sets reserve_expires_at null for COD (§4)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Not found during reserve",
    input: "findOne null ở bước reserve",
    condition: "EC-01",
    expected: "400 not found during reserve; rollback",
    type: "Negative",
    fr: "EC-01",
    test: 'returns 400 "not found during reserve" when findOne returns null (EC-01)',
    result: "Pass",
  },
  {
    id: 6,
    feature: "Out of stock during reserve",
    input: "locked row stock=0",
    condition: "§4",
    expected: "400 Out of stock during reserve",
    type: "Negative",
    fr: "§4",
    test: "returns 400 Out of stock during reserve when locked row has low stock (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Cancel hoàn kho COD",
    input: "POST cancel processing+COD pending",
    condition: "§5.1",
    expected: "increment stock_quantity by OrderItem qty",
    type: "Positive",
    fr: "§5.1",
    test: "increments stock by OrderItem quantity when cancelling eligible COD order (§5.1)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Cancel hoàn kho VNPAY awaiting",
    input: "POST cancel AWAITING_PAYMENT",
    condition: "§5.1",
    expected: "increment đúng qty",
    type: "Positive",
    fr: "§5.1",
    test: "restores stock when cancelling VNPAY AWAITING_PAYMENT order (§5.1)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Cron đăng ký",
    input: "import releaseReservations",
    condition: "§5.2",
    expected: "schedule */2 * * * *",
    type: "Positive",
    fr: "§5.2",
    test: "registers cron schedule every 2 minutes (§5.2)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Cron hết hạn VNPAY",
    input: "reserve_expires_at < now",
    condition: "§5.2",
    expected: "increment; payment failed; order cancelled",
    type: "Positive",
    fr: "§5.2",
    test: "restores stock, fails payment and cancels expired AWAITING_PAYMENT orders (§5.2)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Cron advisory lock",
    input: "pg_try_advisory_lock false",
    condition: "§5.2",
    expected: "không findAll orders",
    type: "Negative",
    fr: "§5.2",
    test: "skips processing when advisory lock is not acquired (§5.2)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ReserveInventory")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_ReserveInventoryOnOrder.md | server/__tests__/orders/reserveInventoryOnOrder.test.js | server/__tests__/jobs/releaseReservations.test.js"
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

  const outPath = path.join(outDir, "UnitTest_ReserveInventoryOnOrder.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
