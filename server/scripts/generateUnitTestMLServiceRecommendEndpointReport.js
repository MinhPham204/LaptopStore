/**
 * Generates docs/reports/recommendation/UnitTest_MLServiceRecommendEndpoint.xlsx
 * Usage: node scripts/generateUnitTestMLServiceRecommendEndpointReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Health check",
    input: "GET /health",
    condition: "§4.1",
    expected: "200; ok, items, x_all_shape",
    type: "Positive",
    fr: "§4.1",
    test: "test_get_health_returns_200_with_health_info_fields",
    result: "Pass",
    layer: "Flask",
  },
  {
    id: 2,
    feature: "Recommend query",
    input: "GET /recommend?variation_id=42",
    condition: "§4.2",
    expected: "200 JSON array; recommend_core(42)",
    type: "Positive",
    fr: "§4.2",
    test: "test_get_recommend_query_returns_200_json_array",
    result: "Pass",
    layer: "ML",
  },
  {
    id: 3,
    feature: "Recommend path",
    input: "GET /recommend/42",
    condition: "§4.3",
    expected: "200; cùng logic path param",
    type: "Positive",
    fr: "§4.3",
    test: "test_get_recommend_path_returns_200_json_array",
    result: "Pass",
    layer: "Flask",
  },
  {
    id: 4,
    feature: "Thiếu variation_id",
    input: "GET /recommend",
    condition: "§4.2",
    expected: "400 variation_id is required",
    type: "Negative",
    fr: "§4.2",
    test: "test_get_recommend_missing_variation_id_returns_400",
    result: "Pass",
    layer: "Flask",
  },
  {
    id: 5,
    feature: "variation_id không hợp lệ",
    input: "GET ?variation_id=abc",
    condition: "§4.2",
    expected: "400 variation_id is required",
    type: "Negative",
    fr: "§4.2",
    test: "test_get_recommend_invalid_variation_id_returns_400",
    result: "Pass",
    layer: "Flask",
  },
  {
    id: 6,
    feature: "Not found query",
    input: "recommend_core (None, 404)",
    condition: "§4.5",
    expected: "404 variation_id not found",
    type: "Negative",
    fr: "§4.5",
    test: "test_get_recommend_not_found_returns_404",
    result: "Pass",
    layer: "ML",
  },
  {
    id: 7,
    feature: "Not found path",
    input: "GET /recommend/999",
    condition: "§4.5",
    expected: "404 variation_id not found",
    type: "Negative",
    fr: "§4.5",
    test: "test_get_recommend_path_not_found_returns_404",
    result: "Pass",
    layer: "ML",
  },
  {
    id: 8,
    feature: "recommend_core logic",
    input: "artifacts thật",
    condition: "GAP",
    expected: "import-time load DF/SCALER/X_ALL",
    type: "Ref",
    fr: "GAP",
    test: "— (test_recommend_core.py không tạo; mock trong conftest)",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 9,
    feature: "TOPK / fresh pool",
    input: "recommend_core",
    condition: "§6",
    expected: "indexed + fresh candidates",
    type: "Ref",
    fr: "§6",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 10,
    feature: "CORS",
    input: "flask-cors",
    condition: "§3",
    expected: "CORS enabled",
    type: "Ref",
    fr: "§3",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 11,
    feature: "Không auth API key",
    input: "public endpoints",
    condition: "GAP",
    expected: "không xác thực",
    type: "Ref",
    fr: "GAP",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/recommendation")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_MLServiceEndpoint")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/recommendations/FR_MLServiceRecommendEndpoint.md | recommendation_service/tests/test_app.py"
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
    { width: 40 },
    { width: 18 },
    { width: 44 },
    { width: 12 },
    { width: 14 },
    { width: 48 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(outDir, "UnitTest_MLServiceRecommendEndpoint.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
