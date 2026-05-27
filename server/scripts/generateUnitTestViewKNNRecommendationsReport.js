/**
 * Generates docs/reports/UnitTest_ViewKNNRecommendations.xlsx
 * Usage: node scripts/generateUnitTestViewKNNRecommendationsReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Gợi ý KNN thành công",
    input: "GET .../variations/10/recommendations; axios 200 items",
    condition: "AC1 enrich fetchProductMeta",
    expected: "200; products[0] id, variation_id, name, score; Product.findAll",
    type: "Positive",
    fr: "AC1",
    test: "returns 200 with mapped products when upstream returns items (AC1)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Parse shape debug",
    input: "axios 200 { debug: [...] }",
    condition: "§7 multi-shape",
    expected: "200; map từ debug array",
    type: "Positive",
    fr: "AC1",
    test: "parses recommendations from debug array shape (AC1)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Dedupe product_id",
    input: "2 items cùng product_id, score khác",
    condition: "§7 bestByProduct",
    expected: "1 product; score cao hơn; variation_id tương ứng",
    type: "Positive",
    fr: "BR-01 / §7",
    test: "deduplicates by product_id keeping the higher score entry",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Metadata response",
    input: "GET success",
    condition: "contract",
    expected: "basedOn.variationId; source knn; generated_at",
    type: "Positive",
    fr: "AC1",
    test: "includes basedOn.variationId and source knn on success (AC1)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "variation_id invalid",
    input: "GET .../variations/abc/recommendations",
    condition: "AC1 edge",
    expected: "400 { products: [], error: 'invalid variation_id' }",
    type: "Negative",
    fr: "AC1 edge",
    test: "returns 400 when variation_id is not a valid number (AC1 edge)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Upstream 404",
    input: "axios status 404",
    condition: "AC3, BR-02",
    expected: "502 upstream_404; products []",
    type: "Negative",
    fr: "AC3 / BR-02",
    test: "returns 502 upstream_404 with empty products when axios status is 404 (AC3, BR-02)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Adapter exception",
    input: "axios reject",
    condition: "AC3",
    expected: "502 adapter_exception; products []",
    type: "Negative",
    fr: "AC3",
    test: "returns 502 adapter_exception when axios rejects (AC3)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Upstream rỗng",
    input: "axios 200 items []",
    condition: "AC1 empty",
    expected: "200 products []",
    type: "Negative",
    fr: "AC1",
    test: "returns 200 with empty products when upstream items is empty",
    result: "Pass",
  },
  {
    id: 9,
    feature: "FE refetch khi đổi variation",
    input: "ProductDetailPage toggleSelect",
    condition: "AC2",
    expected: "N/A — Vitest / E2E (không ghi Excel chi tiết)",
    type: "Ref",
    fr: "AC2",
    test: "—",
    result: "N/A",
  },
  {
    id: 10,
    feature: "FE add-to-cart từ RecoCard",
    input: "ProductRecommendations",
    condition: "AC4",
    expected: "N/A — client test riêng",
    type: "Ref",
    fr: "AC4",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewKNNRecommendations")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ViewKNNRecommendationsOnProduct.md | server/__tests__/catalog/viewKNNRecommendations.test.js"
  sheet.getCell("A1").font = { bold: true }

  const headers = [
    "ID",
    "Tính năng",
    "Đầu vào",
    "Điều kiện kiểm thử",
    "Kết quả mong đợi",
    "Loại",
    "Mã FR",
    "Tên test Jest",
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
    { width: 24 },
    { width: 44 },
    { width: 12 },
    { width: 18 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ViewKNNRecommendations.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
