/**
 * Generates docs/reports/UnitTest_ViewProductListV2.xlsx
 * Usage: node scripts/generateUnitTestViewProductListV2Report.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Pagination FE default",
    input: "GET ?page=1&limit=30",
    condition: "offset=0, distinct true",
    expected: "200; pagination page/limit/totalPages",
    type: "Positive",
    fr: "AC6 / FE",
    test: "uses page=1 and limit=30 with correct offset",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Pagination BE default",
    input: "GET không page/limit",
    condition: "FR default",
    expected: "limit=12, page=1",
    type: "Positive",
    fr: "API default",
    test: "defaults to page=1 and limit=12 when pagination params are omitted",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Sort price_asc / price_desc / newest",
    input: "sort_by presets",
    condition: "order clause",
    expected: "base_price ASC/DESC; created_at DESC",
    type: "Positive",
    fr: "AC1 sort",
    test: "orders by price_asc / price_desc / newest",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Sort best_selling",
    input: "sort_by=best_selling",
    condition: "sold_qty subquery",
    expected: "attributes sold_qty; order sold_qty DESC",
    type: "Positive",
    fr: "AC3 / BR-03",
    test: "orders by sold_qty DESC when sort_by=best_selling",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Default sort",
    input: "sort_by rỗng",
    condition: "invalid sort",
    expected: "created_at DESC",
    type: "Positive",
    fr: "BR default",
    test: "defaults order to created_at DESC when sort_by is empty",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Category / brand single",
    input: "category_id=5&brand_id=2",
    condition: "where equality",
    expected: "category_id=5; brand_id=2",
    type: "Positive",
    fr: "AC2",
    test: "filters by single category_id and brand_id",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Category / brand CSV",
    input: "category_id=1,3&brand_id=10,20",
    condition: "Op.in",
    expected: "IN lists",
    type: "Positive",
    fr: "AC2",
    test: "filters by multiple category_id and brand_id from CSV",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Spec filters + aliases",
    input: "cpu, ram, ssd, gpu, screenSize",
    condition: "variationWhere",
    expected: "variations required:true; IN filters",
    type: "Positive",
    fr: "AC5 / aliases",
    test: "filters variation specs and aliases cpu, gpu, screenSize, ssd",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Canonical spec param names",
    input: "processor, ram, storage, graphics_card, screen_size",
    condition: "variation required",
    expected: "variationWhere set",
    type: "Positive",
    fr: "AC5",
    test: "filters processor, ram, storage, graphics_card, screen_size by canonical param names",
    result: "Pass",
  },
  {
    id: 10,
    feature: "No spec filter",
    input: "GET default",
    condition: "no variationWhere",
    expected: "variations không required",
    type: "Positive",
    fr: "AC5 negative",
    test: "does not set variations required when no spec filters are provided",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Price range",
    input: "min_price & max_price",
    condition: "base_price",
    expected: "Op.gte / Op.lte on base_price",
    type: "Positive",
    fr: "Filter price",
    test: "filters base_price with min_price and max_price",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Search keyword",
    input: "search=macbook",
    condition: "AC4",
    expected: "product_name iLike %macbook%",
    type: "Positive",
    fr: "AC4",
    test: "filters product_name with iLike when search is provided",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Response shape",
    input: "count=45 page=2 limit=30",
    condition: "AC6",
    expected: "products, pagination, total, totalPages",
    type: "Positive",
    fr: "AC6",
    test: "returns products, pagination, total, and totalPages",
    result: "Pass",
  },
  {
    id: 14,
    feature: "Không filter is_active",
    input: "GET với nhiều filter",
    condition: "FR §3",
    expected: "where.is_active undefined",
    type: "Positive",
    fr: "BR-05 / §3",
    test: "does not include is_active in product where clause",
    result: "Pass",
  },
  {
    id: 15,
    feature: "Empty catalog",
    input: "count=0",
    condition: "AC2",
    expected: "200 products=[]",
    type: "Negative",
    fr: "AC2",
    test: "returns 200 with empty products when count is zero",
    result: "Pass",
  },
  {
    id: 16,
    feature: "DB error",
    input: "findAndCountAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when findAndCountAll throws",
    result: "Pass",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewProductListV2")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ViewProductListV2.md | server/__tests__/catalog/viewProductListV2.test.js"
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
    { width: 28 },
    { width: 44 },
    { width: 12 },
    { width: 20 },
    { width: 54 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ViewProductListV2.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
