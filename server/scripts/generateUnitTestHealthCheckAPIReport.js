/**
 * Generates docs/reports/system/UnitTest_HealthCheckAPI.xlsx
 * Usage: node scripts/generateUnitTestHealthCheckAPIReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Health check OK",
    input: "GET /api/health",
    condition: "§4 / AC",
    expected: "200 { status: OK, message: Server is running }",
    type: "Positive",
    fr: "§4",
    test: "returns 200 with status OK and Server is running message (§4)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Không cần auth",
    input: "GET không Authorization",
    condition: "§4 / BR-02",
    expected: "200",
    type: "Positive",
    fr: "§4",
    test: "returns 200 without Authorization header (BR-02 / AC §11)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Response JSON",
    input: "GET /api/health",
    condition: "§4",
    expected: "Content-Type application/json",
    type: "Positive",
    fr: "§4",
    test: "returns JSON content type",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Method POST",
    input: "POST /api/health",
    condition: "AC §11",
    expected: "404",
    type: "Negative",
    fr: "AC §11",
    test: "returns 404 for POST /api/health",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Method PUT",
    input: "PUT /api/health",
    condition: "AC §11",
    expected: "404",
    type: "Negative",
    fr: "AC §11",
    test: "returns 404 for PUT /api/health",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Sai path /health",
    input: "GET /health",
    condition: "§3 Out of Scope",
    expected: "404",
    type: "Negative",
    fr: "§3",
    test: "returns 404 for GET /health (not mounted on main API)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Sai path healthz",
    input: "GET /api/healthz",
    condition: "§4",
    expected: "404",
    type: "Negative",
    fr: "§4",
    test: "returns 404 for GET /api/healthz",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Không ping DB",
    input: "N/A — documented",
    condition: "GAP-01",
    expected: "Health không kiểm tra DB; false positive nếu DB down",
    type: "Ref",
    fr: "GAP-01",
    test: "(Ref) FR §12 GAP-01 — no database readiness check",
    result: "Documented",
  },
  {
    id: 9,
    feature: "Docker probe path",
    input: "N/A — documented",
    condition: "GAP-02",
    expected: "Probe có thể dùng /health thay vì /api/health",
    type: "Ref",
    fr: "GAP-02",
    test: "(Ref) FR §12 GAP-02 — Docker/K8s path may differ from /api/health",
    result: "Documented",
  },
  {
    id: 10,
    feature: "Test harness",
    input: "Minimal Express app",
    condition: "§5",
    expected: "Handler giống server.js L48-50; không import server.js",
    type: "Ref",
    fr: "§5",
    test: "(Ref) Test app mirrors server/server.js L48-50 inline handler",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/system")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_HealthCheckAPI")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/system/FR_HealthCheckAPI.md | server/__tests__/system/healthCheckAPI.test.js"
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
    { width: 22 },
    { width: 48 },
    { width: 12 },
    { width: 18 },
    { width: 62 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_HealthCheckAPI.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
