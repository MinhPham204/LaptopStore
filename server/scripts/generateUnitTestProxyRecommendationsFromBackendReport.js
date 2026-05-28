/**
 * Generates docs/reports/recommendation/UnitTest_ProxyRecommendationsFromBackend.xlsx
 * Usage: node scripts/generateUnitTestProxyRecommendationsFromBackendReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Proxy + enrich",
    input: "upstream { items }; Product.findAll",
    condition: "§5, AC",
    expected: "200; products mapped; slug, image, score",
    type: "Positive",
    fr: "§5 / AC",
    test: "returns 200 with mapped products when upstream returns items and DB enrich (§5, AC)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 2,
    feature: "Flask raw array",
    input: "upstream JSON array",
    condition: "BR-03",
    expected: "parse không cần items wrapper",
    type: "Positive",
    fr: "BR-03",
    test: "parses upstream raw JSON array without items wrapper (BR-03)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 3,
    feature: "debug array",
    input: "payload.debug",
    condition: "BR-04",
    expected: "200 products từ debug",
    type: "Positive",
    fr: "BR-04",
    test: "parses recommendations from payload.debug array (BR-04)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 4,
    feature: "Dedupe product_id",
    input: "2 variation cùng product",
    condition: "BR-05",
    expected: "giữ score cao hơn",
    type: "Positive",
    fr: "BR-05",
    test: "deduplicates by product_id keeping the higher score entry (BR-05)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 5,
    feature: "performance_score",
    input: "không score; có performance_score",
    condition: "§6.3",
    expected: "score = performance_score",
    type: "Positive",
    fr: "§6.3",
    test: "uses performance_score as score when score is absent (§6.3)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 6,
    feature: "Metadata response",
    input: "GET hợp lệ",
    condition: "§5",
    expected: "basedOn, source knn, generated_at",
    type: "Positive",
    fr: "§5",
    test: "includes basedOn.variationId, source knn and generated_at (§5)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 7,
    feature: "Sort score",
    input: "nhiều products",
    condition: "BR-07",
    expected: "score giảm dần",
    type: "Positive",
    fr: "BR-07",
    test: "sorts products by score descending (BR-07)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 8,
    feature: "explain block",
    input: "upstream có explain fields",
    condition: "§6.4",
    expected: "explain object đầy đủ",
    type: "Positive",
    fr: "§6.4",
    test: "maps explain fields when upstream provides them (§6.4)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 9,
    feature: "Upstream rỗng",
    input: "items []",
    condition: "§5",
    expected: "200 []; không findAll",
    type: "Positive",
    fr: "§5",
    test: "returns 200 with empty products and skips findAll when upstream is empty (§5)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 10,
    feature: "Public API",
    input: "không Authorization",
    condition: "BR-13",
    expected: "200",
    type: "Positive",
    fr: "BR-13",
    test: "returns 200 without Authorization header (BR-13)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 11,
    feature: "variation_id abc",
    input: "param abc",
    condition: "BR-02",
    expected: "400 invalid variation_id; không axios",
    type: "Negative",
    fr: "BR-02",
    test: "returns 400 invalid variation_id when param is abc and does not call axios (BR-02)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 12,
    feature: "variation_id 0",
    input: "param 0",
    condition: "BR-02",
    expected: "400 invalid variation_id; không axios",
    type: "Negative",
    fr: "BR-02",
    test: "returns 400 invalid variation_id when param is 0 and does not call axios (BR-02)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 13,
    feature: "Upstream 404",
    input: "axios status 404",
    condition: "§5",
    expected: "502 upstream_404; products []",
    type: "Negative",
    fr: "§5",
    test: "returns 502 upstream_404 with empty products when upstream status is 404 (§5)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 14,
    feature: "Upstream 500",
    input: "axios status 500",
    condition: "§5",
    expected: "502 upstream_500; products []",
    type: "Negative",
    fr: "§5",
    test: "returns 502 upstream_500 when upstream status is 500 (§5)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 15,
    feature: "Adapter exception",
    input: "axios reject",
    condition: "§5",
    expected: "502 adapter_exception + detail",
    type: "Negative",
    fr: "§5",
    test: "returns 502 adapter_exception with detail when axios rejects (§5)",
    result: "Pass",
    layer: "Proxy",
  },
  {
    id: 16,
    feature: "RECO_API_BASE / TIMEOUT",
    input: "env",
    condition: "§4",
    expected: "RECO_API_BASE default 127.0.0.1:8000; RECO_TIMEOUT_MS 7000",
    type: "Ref",
    fr: "§4",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 17,
    feature: "RECOMMENDATION_SERVICE_URL",
    input: "docker-compose env",
    condition: "GAP-01",
    expected: "không đọc bởi controller; dùng RECO_API_BASE",
    type: "Ref",
    fr: "GAP-01",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 18,
    feature: "Docker PORT mismatch",
    input: "Flask PORT vs expose",
    condition: "GAP-02",
    expected: "cần PORT=5001 + RECO_API_BASE đúng",
    type: "Ref",
    fr: "GAP-02",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/recommendation")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ProxyRecoBackend")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/recommendations/FR_ProxyRecommendationsFromBackend.md | server/__tests__/recommendations/proxyRecommendationsFromBackend.test.js"
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
    { width: 58 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(
    outDir,
    "UnitTest_ProxyRecommendationsFromBackend.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
