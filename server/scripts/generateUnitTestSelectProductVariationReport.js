/**
 * Generates docs/reports/UnitTest_SelectProductVariation.xlsx
 * Usage: node scripts/generateUnitTestSelectProductVariationReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Default primary SKU",
    input: "variations có is_primary",
    condition: "AC1",
    expected: "pickDefaultVariation → variation_id primary; sel đầy đủ; isReady true",
    type: "Positive",
    fr: "AC1",
    test: "picks primary variation when is_primary exists (AC1)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 2,
    feature: "Default cheapest SKU",
    input: "không có is_primary",
    condition: "AC1 fallback",
    expected: "variation giá thấp nhất (22000000)",
    type: "Positive",
    fr: "AC1",
    test: "picks cheapest variation when no primary flag (AC1 fallback)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 3,
    feature: "Full selection ready",
    input: "sel khớp variation 11",
    condition: "AC2",
    expected: "isReady true; finalPrice 19800000 (discount 10%)",
    type: "Positive",
    fr: "AC2",
    test: "sets isReady true and finalPrice for a full valid selection (AC2)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 4,
    feature: "Invalid combination disabled",
    input: "M3+16GB+512GB+Gray",
    condition: "AC3",
    expected: "isDisabled(color, Gray) true",
    type: "Positive",
    fr: "AC3",
    test: "returns isDisabled true when attribute combination does not exist (AC3)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 5,
    feature: "Add-to-cart variation_id",
    input: "default primary sel",
    condition: "AC4",
    expected: "matched.variation_id = 10",
    type: "Positive",
    fr: "AC4",
    test: "exposes matched.variation_id when selection is complete (AC4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 6,
    feature: "Reset selection",
    input: "resetSelection()",
    condition: "AC6",
    expected: "isReady false; sel rỗng",
    type: "Positive",
    fr: "AC6",
    test: "reset selection yields isReady false (AC6)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 7,
    feature: "Single variation",
    input: "1 variation only",
    condition: "§11 edge",
    expected: "isReady true sau pickDefault",
    type: "Positive",
    fr: "Edge",
    test: "auto-ready when product has a single variation",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 8,
    feature: "Partial selection",
    input: "chỉ processor + ram",
    condition: "§11 edge",
    expected: "isReady false; choose-attrs",
    type: "Positive",
    fr: "Edge",
    test: "isReady false when only partial attributes are selected",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 9,
    feature: "Deselect chip",
    input: "toggleSelect same ram value",
    condition: "§11 edge",
    expected: "color ''; allSelected false; isReady false",
    type: "Positive",
    fr: "Edge",
    test: "deselecting a chip clears attribute and breaks readiness",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 10,
    feature: "Validation inactive",
    input: "is_active false",
    condition: "§7",
    expected: "inactive",
    type: "Positive",
    fr: "Validation",
    test: "returns inactive when product is not active",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 11,
    feature: "Validation choose-attrs",
    input: "partial sel",
    condition: "§7",
    expected: "choose-attrs",
    type: "Positive",
    fr: "Validation",
    test: "returns choose-attrs when selection is incomplete",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 12,
    feature: "Validation out-of-stock",
    input: "stock_quantity 0",
    condition: "§7",
    expected: "out-of-stock",
    type: "Positive",
    fr: "Validation",
    test: "returns out-of-stock when matched variation has zero stock",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 13,
    feature: "Validation soldout",
    input: "is_available false",
    condition: "§7",
    expected: "soldout",
    type: "Positive",
    fr: "Validation",
    test: "returns soldout when matched variation is not available",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 14,
    feature: "Validation exceed-stock",
    input: "quantity 99",
    condition: "§7",
    expected: "exceed-stock",
    type: "Positive",
    fr: "Validation",
    test: "returns exceed-stock when quantity exceeds stock",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 15,
    feature: "Validation OK",
    input: "ready sel in stock",
    condition: "§7",
    expected: "null",
    type: "Positive",
    fr: "Validation",
    test: "returns null when selection is valid and in stock",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 16,
    feature: "Detail API variations",
    input: "GET /api/products/1",
    condition: "§9 BE",
    expected: "variations[] processor, ram, price, stock, is_primary",
    type: "Positive",
    fr: "§9",
    test: "returns variations with processor, ram, price, stock_quantity, is_primary",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 17,
    feature: "Product not found",
    input: "GET /api/products/999",
    condition: "negative",
    expected: "404",
    type: "Negative",
    fr: "AC3 detail",
    test: "returns 404 when product is not found",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 18,
    feature: "Reco refetch on variation change",
    input: "useRecommendedByVariation",
    condition: "AC5",
    expected: "N/A — hook/integration test riêng",
    type: "Ref",
    fr: "AC5",
    test: "—",
    result: "N/A",
    layer: "Client",
  },
  {
    id: 19,
    feature: "URL ?v= preselect",
    input: "query v=variation_id",
    condition: "§15 gap",
    expected: "N/A — PDP chưa đọc ?v=",
    type: "Ref",
    fr: "Gap",
    test: "—",
    result: "N/A",
    layer: "Client",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_SelectVariation")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_SelectProductVariation.md"
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
    { width: 32 },
    { width: 22 },
    { width: 44 },
    { width: 12 },
    { width: 16 },
    { width: 58 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_SelectProductVariation.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
