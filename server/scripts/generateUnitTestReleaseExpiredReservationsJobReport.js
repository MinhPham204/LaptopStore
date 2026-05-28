/**
 * Generates docs/reports/system/UnitTest_ReleaseExpiredReservationsJob.xlsx
 * Usage: node scripts/generateUnitTestReleaseExpiredReservationsJobReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Đăng ký cron 2 phút",
    input: "require releaseReservations",
    condition: "BR-03",
    expected: 'cron.schedule("*/2 * * * *", fn)',
    type: "Positive",
    fr: "BR-03",
    test: "registers cron schedule every 2 minutes (BR-03)",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 2,
    feature: "Xử lý đơn hết hạn",
    input: "1 AWAITING_PAYMENT expired",
    condition: "§6.2",
    expected: "hoàn kho; payment failed; cancelled",
    type: "Positive",
    fr: "§6.2",
    test: "restores stock, fails payment and cancels expired AWAITING_PAYMENT orders (§6.2)",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 3,
    feature: "Advisory unlock",
    input: "tick thành công",
    condition: "BR-05",
    expected: "pg_advisory_unlock(987654321)",
    type: "Positive",
    fr: "BR-05",
    test: "calls pg_advisory_unlock(987654321) after successful tick (BR-05)",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 4,
    feature: "Query expired orders",
    input: "Order.findAll",
    condition: "BR-08",
    expected: "AWAITING_PAYMENT + reserve_expires_at Op.lt",
    type: "Positive",
    fr: "BR-08",
    test: "queries expired orders with AWAITING_PAYMENT and reserve_expires_at Op.lt now (BR-08)",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 5,
    feature: "Không có đơn expired",
    input: "findAll []",
    condition: "§6.2",
    expected: "commit; không Payment.update",
    type: "Positive",
    fr: "§6.2",
    test: "commits without Payment.update when no expired orders",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 6,
    feature: "Nhiều OrderItem",
    input: "2 lines quantity khác nhau",
    condition: "BR-09",
    expected: "increment theo từng quantity",
    type: "Positive",
    fr: "BR-09",
    test: "increments stock per OrderItem line quantity (BR-09)",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 7,
    feature: "Không lấy được lock",
    input: "pg_try_advisory_lock false",
    condition: "BR-06",
    expected: "không findAll/commit",
    type: "Positive",
    fr: "BR-06",
    test: "skips processing when advisory lock is not acquired (BR-06)",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 8,
    feature: "Lỗi findAll",
    input: "Order.findAll throw",
    condition: "BR-14",
    expected: "rollback; console.error; no commit",
    type: "Negative",
    fr: "BR-14",
    test: "rolls back and logs when Order.findAll throws (BR-14)",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 9,
    feature: "Variation null",
    input: "findOne null",
    condition: "GAP-02",
    expected: "bỏ increment; order vẫn cancelled",
    type: "Negative",
    fr: "GAP-02",
    test: "still cancels order when ProductVariation.findOne returns null (GAP-02)",
    result: "Pass",
    layer: "Job",
  },
  {
    id: 10,
    feature: "COD ngoài scope",
    input: "N/A — documented",
    condition: "§3 Out of Scope",
    expected: "COD reserve_expires_at null — job không chọn",
    type: "Ref",
    fr: "§3",
    test: "(Ref) COD orders out of scope — processing, no reserve_expires_at",
    result: "Documented",
    layer: "Ref",
  },
  {
    id: 11,
    feature: "Tạo đơn 24h reserve",
    input: "N/A — cross-ref",
    condition: "§4",
    expected: "createOrder VNPay set reserve_expires_at +24h",
    type: "Ref",
    fr: "§4",
    test: "(Ref) See server/__tests__/orders/reserveInventoryOnOrder.test.js for 24h hold on create",
    result: "Documented",
    layer: "Ref",
  },
  {
    id: 12,
    feature: "Không email hủy",
    input: "N/A — documented",
    condition: "GAP-04",
    expected: "Job không gửi email khi auto-cancel",
    type: "Ref",
    fr: "GAP-04",
    test: "(Ref) FR §13 GAP-04 — no customer email on auto-cancel",
    result: "Documented",
    layer: "Ref",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/system")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ReleaseReservations")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/system/FR_ReleaseExpiredReservationsJob.md | server/__tests__/jobs/releaseReservations.test.js"
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
    "Layer",
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
      r.layer,
    ])
  })

  sheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 36 },
    { width: 22 },
    { width: 48 },
    { width: 12 },
    { width: 18 },
    { width: 62 },
    { width: 14 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_ReleaseExpiredReservationsJob.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
