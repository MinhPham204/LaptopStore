/**
 * Export active variation_id values for JMeter CSV Data Set.
 * Usage (from repo root): node jmeter/scripts/export-variation-ids.js
 */
const fs = require("fs")
const path = require("path")

const repoRoot = path.resolve(__dirname, "../..")
const serverEnv = path.join(repoRoot, "server", ".env")
require(path.join(repoRoot, "server", "node_modules", "dotenv")).config({
  path: serverEnv,
})

const { Product, ProductVariation } = require(path.join(
  repoRoot,
  "server",
  "models",
))
const sequelize = require(path.join(repoRoot, "server", "config", "database"))

const OUT_DIR = path.join(repoRoot, "jmeter", "data")
const OUT_FILE = path.join(OUT_DIR, "variation_ids.csv")
const LIMIT = 50

async function main() {
  const rows = await ProductVariation.findAll({
    attributes: ["variation_id"],
    where: { is_available: true },
    include: [
      {
        model: Product,
        as: "product",
        attributes: [],
        where: { is_active: true },
        required: true,
      },
    ],
    order: [["variation_id", "ASC"]],
    limit: LIMIT,
  })

  if (rows.length === 0) {
    console.error(
      "Không tìm thấy variation_id (is_available + product.is_active). Kiểm tra DB/seed.",
    )
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const lines = ["variation_id", ...rows.map((r) => String(r.variation_id))]
  fs.writeFileSync(OUT_FILE, lines.join("\n") + "\n", "utf8")
  console.log(`Đã ghi ${rows.length} variation_id → ${OUT_FILE}`)
}

main()
  .catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
  .finally(() => sequelize.close())
