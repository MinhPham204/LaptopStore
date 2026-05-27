/**
 * Generates docs/reports/UnitTest_ViewProductSpecsModal.xlsx
 * Usage: node scripts/generateUnitTestViewProductSpecsModalReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "normalizeSpecs null/empty",
    input: "specs null, {}",
    condition: "AC4",
    expected: "return {}",
    type: "Positive",
    fr: "AC4",
    test: "returns empty object for null or empty specs",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 2,
    feature: "Flatten FR example JSON",
    input: "weight, display[], audio{}",
    condition: "FR §7 example",
    expected: "Weight, Kích thước, Độ phân giải, Audio - Speakers",
    type: "Positive",
    fr: "AC1 / AC2",
    test: "flattens display array, audio object, and weight scalar from FR example",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 3,
    feature: "briefSpecs 6 dòng",
    input: "8 scalar sections",
    condition: "slice(0,6)",
    expected: "brief có đúng 6 key đầu",
    type: "Positive",
    fr: "AC1",
    test: "builds briefSpecs from the first six flat entries only",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 4,
    feature: "Nested object key format",
    input: "display: { kich_thuoc, do_phan_giai }",
    condition: "Title(section) - Title(k)",
    expected: '"Display - ..." keys',
    type: "Positive",
    fr: "AC2",
    test: 'uses "Display - Kích thước" style keys for nested objects',
    result: "Pass",
    layer: "FE",
  },
  {
    id: 5,
    feature: "SpecsTable empty",
    input: "specs={}",
    condition: "AC4",
    expected: "Chưa có thông số kỹ thuật.",
    type: "Positive",
    fr: "AC4",
    test: "shows empty message when specs is empty",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 6,
    feature: "SpecsTable rows",
    input: "CPU, RAM",
    condition: "AC1",
    expected: "Render label/value rows",
    type: "Positive",
    fr: "AC1",
    test: "renders label and value rows for normalized specs",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 7,
    feature: "Modal closed",
    input: "open=false",
    condition: "AC2",
    expected: "render null",
    type: "Positive",
    fr: "AC2",
    test: "renders null when open is false",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 8,
    feature: "Modal open",
    input: "open=true + flatSpecs",
    condition: "AC2 / AC3",
    expected: "Title + SpecsTable rows",
    type: "Positive",
    fr: "AC2 / AC3",
    test: "renders title and SpecsTable when open is true",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 9,
    feature: "Backdrop close",
    input: "click backdrop",
    condition: "AC3",
    expected: "onClose called",
    type: "Positive",
    fr: "AC3",
    test: "calls onClose when backdrop is clicked",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 10,
    feature: "PDP trigger integration",
    input: "ProductDetailPage buttons",
    condition: "setSpecOpen",
    expected: "Manual / E2E",
    type: "N/A",
    fr: "AC1 trigger",
    test: "N/A — ProductDetailPage integration (Xem tất cả / Cpu button)",
    result: "N/A",
    layer: "Integration",
  },
  {
    id: 11,
    feature: "Modal scroll dài",
    input: "max-h-[75vh]",
    condition: "AC5",
    expected: "CSS scroll container",
    type: "N/A",
    fr: "AC5",
    test: "N/A — scroll layout (visual/CSS)",
    result: "N/A",
    layer: "FE",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewProductSpecsModal")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ViewProductSpecsModal.md | client/__tests__/specs/productSpecsModal.test.jsx"
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
    { width: 28 },
    { width: 44 },
    { width: 12 },
    { width: 18 },
    { width: 52 },
    { width: 14 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ViewProductSpecsModal.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
