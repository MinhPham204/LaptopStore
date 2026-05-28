/**
 * Generates docs/reports/recommendation/UnitTest_TrainRecommendationModelOffline.xlsx
 * Usage: node scripts/generateUnitTestTrainRecommendationModelOfflineReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "jaccard identical",
    input: "2 set giống nhau",
    condition: "§5.2",
    expected: "1.0",
    type: "Positive",
    fr: "§5.2",
    test: "test_jaccard_identical_sets_returns_one",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 2,
    feature: "simplify_cpu_name",
    input: "Intel Core i7",
    condition: "§5.2",
    expected: "chuỗi chứa i7; không intel",
    type: "Positive",
    fr: "§5.2",
    test: "test_simplify_cpu_name_normalizes_intel_core",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 3,
    feature: "best_match exact",
    input: "bench row khớp simple",
    condition: "§5.2",
    expected: "json-exact + score",
    type: "Positive",
    fr: "§5.2",
    test: "test_best_match_score_exact_match_returns_json_exact",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 4,
    feature: "best_match fuzzy",
    input: "Jaccard >= 0.60",
    condition: "§5.2",
    expected: "json-contains",
    type: "Positive",
    fr: "§5.2",
    test: "test_best_match_score_fuzzy_returns_json_contains",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 5,
    feature: "score_ram",
    input: "16GB",
    condition: "§5.4",
    expected: "70",
    type: "Positive",
    fr: "§5.4",
    test: "test_score_ram_16gb_returns_rule_score",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 6,
    feature: "score_storage",
    input: "1TB SSD",
    condition: "§5.4",
    expected: "80",
    type: "Positive",
    fr: "§5.4",
    test: "test_score_storage_1tb_returns_rule_score",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 7,
    feature: "fallback CPU/GPU",
    input: "chuỗi tier",
    condition: "§5.2",
    expected: "điểm rule tier",
    type: "Positive",
    fr: "§5.2",
    test: "test_fallback_cpu_score_tier / test_fallback_gpu_score_tier",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 8,
    feature: "main pipeline artifacts",
    input: "mock DB + empty bench",
    condition: "§5.6",
    expected: "4 files trong ARTIFACTS_DIR",
    type: "Positive",
    fr: "§5.6",
    test: "test_main_writes_four_artifact_files",
    result: "Pass",
    layer: "Python",
  },
  {
    id: 9,
    feature: "main empty DB",
    input: "DataFrame rỗng",
    condition: "§5.1",
    expected: "return sớm; không ghi artifacts",
    type: "Positive",
    fr: "§5.1",
    test: "test_main_returns_early_when_db_dataframe_empty",
    result: "Pass",
    layer: "Python",
  },
  {
    id: 10,
    feature: "jaccard empty",
    input: "set rỗng",
    condition: "§5.2",
    expected: "0.0",
    type: "Negative",
    fr: "§5.2",
    test: "test_jaccard_empty_set_returns_zero",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 11,
    feature: "best_match empty query",
    input: '"" hoặc None',
    condition: "§5.2",
    expected: "(None, None)",
    type: "Negative",
    fr: "§5.2",
    test: "test_best_match_score_empty_query_returns_none",
    result: "Pass",
    layer: "Train",
  },
  {
    id: 12,
    feature: "fetch_data_from_db lỗi",
    input: "mock raise RuntimeError",
    condition: "§5.1",
    expected: "main propagate exception",
    type: "Negative",
    fr: "§5.1",
    test: "test_main_propagates_when_fetch_data_from_db_raises",
    result: "Pass",
    layer: "Python",
  },
  {
    id: 13,
    feature: "Chỉ is_available=true",
    input: "SQL WHERE",
    condition: "BR-01",
    expected: "query train chỉ available",
    type: "Ref",
    fr: "BR-01",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 14,
    feature: "Train vs runtime scoring",
    input: "train_recommend vs core/features",
    condition: "GAP",
    expected: "logic scoring có thể lệch",
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
  const sheet = workbook.addWorksheet("UnitTest_TrainRecoOffline")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/recommendations/FR_TrainRecommendationModelOffline.md | recommendation_service/tests/test_train_recommend.py"
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
    { width: 52 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(outDir, "UnitTest_TrainRecommendationModelOffline.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
