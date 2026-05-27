/**
 * Generates docs/reports/UnitTest_ProductTagsInDetail.xlsx
 * Usage: node scripts/generateUnitTestProductTagsInDetailReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Hai tags trong detail",
    input: "GET /api/products/1; mock 2 Tags",
    condition: "AC1",
    expected: "200; Tags.length=2; tag_id, tag_name, slug mỗi tag",
    type: "Positive",
    fr: "AC1",
    test: "returns 200 with two tags including tag_id, tag_name, and slug (AC1)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Không có tag",
    input: "mock Tags: []",
    condition: "AC2, BR-01",
    expected: "200; Tags []",
    type: "Positive",
    fr: "AC2 / BR-01",
    test: "returns 200 with empty Tags array when product has no tags (AC2, BR-01)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Include Tag association",
    input: "spy Product.findOne include",
    condition: "AC4, BR-02",
    expected: "{ model: Tag, through: { attributes: [] } }",
    type: "Positive",
    fr: "AC4 / BR-02",
    test: "includes Tag association with through.attributes empty array (AC4, BR-02)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Không lộ pivot JSON",
    input: "tag object trong response",
    condition: "AC4",
    expected: "không product_tags / ProductTag / product_id trên tag",
    type: "Positive",
    fr: "AC4",
    test: "does not expose pivot or junction fields on tag objects in JSON (AC4)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "SP không tồn tại",
    input: "findOne null",
    condition: "BR-02 negative",
    expected: "404; không body.product.Tags",
    type: "Negative",
    fr: "BR-02",
    test: "returns 404 without product Tags when product is not found (BR-02)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "FE hiển thị chip tag",
    input: "ProductDetailPage UI",
    condition: "AC3 gap",
    expected: "N/A — chưa render Tags trên PDP",
    type: "Ref",
    fr: "AC3",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ProductTagsInDetail")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ProductTagsInDetail.md | server/__tests__/catalog/productTagsInDetail.test.js"
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
    { width: 34 },
    { width: 22 },
    { width: 44 },
    { width: 12 },
    { width: 16 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ProductTagsInDetail.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
