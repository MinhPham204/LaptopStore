# Functional Requirement (FR) — Lấy facet lọc sản phẩm (Get Product Facets)

## 1. Feature Overview

API **`GET /api/products/facets`** trả về **danh sách giá trị distinct** dùng làm **tùy chọn bộ lọc kỹ thuật** trên HomePage (CPU, RAM, ổ cứng, GPU, màn hình, cân nặng). Không kèm **số lượng sản phẩm** (count) per facet — chỉ mảng string đã sort alphabetically.

FE: `useProductFacets()` — `staleTime: 10 phút`.

Listing **`GET /api/products/v2`** nhận các giá trị user chọn và filter qua `ProductVariation` + `products.specs` (weight).

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Customer** | Mở panel filter spec trên HomePage |
| **System** | Aggregate DISTINCT từ DB |

---

## 3. Scope

### In Scope

- Facets: `processor`, `ram`, `storage`, `graphics_card`, `screen_size` — từ bảng **`product_variations`**.
- Facet `weight` — từ **`products.specs` JSONB** key `weight` (raw SQL).
- Response shape `{ facets: { ... } }`.

### Out of Scope

- Facet brand/category (lấy từ `FR_ListBrands` / `FR_ListCategories`).
- Dynamic counts (“Intel i7 (12)”).
- Cache server-side (mỗi GET query DB).

---

## 4. API Contract

### Endpoint

```
GET /api/products/facets
```

**Auth:** Public.

### Response — 200 OK

```json
{
  "facets": {
    "processor": ["Intel Core i5", "Intel Core i7", "AMD Ryzen 7"],
    "ram": ["8GB", "16GB", "32GB"],
    "storage": ["256GB SSD", "512GB SSD", "1TB SSD"],
    "graphics_card": ["Intel Iris Xe", "NVIDIA RTX 4060"],
    "screen_size": ["14\"", "15.6\"", "16\""],
    "weight": ["1.5kg", "1.8kg", "2.1kg"]
  }
}
```

Mỗi mảng: **unique**, **non-null**, **non-empty string**, sort `localeCompare`.

---

## 5. Backend Algorithm

### Variation fields (`distinctVariationField`)

```javascript
ProductVariation.findAll({
  attributes: [[Sequelize.fn("DISTINCT", Sequelize.col(field)), "value"]],
  where: {
    [Op.and]: [
      Sequelize.where(Sequelize.col(field), { [Op.ne]: null }),
      Sequelize.where(Sequelize.col(field), { [Op.ne]: "" }),
    ],
  },
  raw: true,
});
```

Chạy **song song** `Promise.all` cho 5 field.

### Weight (PostgreSQL JSONB)

```sql
SELECT DISTINCT (specs->>'weight') AS value
FROM products
WHERE specs ? 'weight'
  AND (specs->>'weight') IS NOT NULL
  AND (specs->>'weight') <> ''
LIMIT 200;
```

- Nếu query throw → `weights = []` (try/catch, không fail cả endpoint).

---

## 6. Mapping sang filter v2

Khi user chọn facet values trên HomePage → `specFilters` → `useProductsV2`:

| Facet key | Query param v2 | Filter target |
|-----------|----------------|---------------|
| processor | `processor` (CSV) | `variationWhere.processor IN (...)` |
| ram | `ram` | `variationWhere.ram` |
| storage | `storage` | `variationWhere.storage` |
| graphics_card | `graphics_card` | `variationWhere.graphics_card` |
| screen_size | `screen_size` | `variationWhere.screen_size` |
| weight (range UI) | `min_weight`, `max_weight` | Parse numeric từ `specs->>'weight'` REGEXP |

**Alias query v2 (controller):** `cpu` → processor, `ssd` → storage, `gpu` → graphics_card, `screenSize` → screen_size.

---

## 7. Frontend — HomePage

```javascript
const { data: facetsData } = useProductFacets();
const facets = facetsData?.facets ?? {};
const processors = facets.processor ?? [];
// ... rams, storages, gpus, screens
```

UI checkbox/chip cho từng nhóm; `toggleInList` cập nhật `specFilters`.

**Weight:** FE có `minWeight` / `maxWeight` — không nhất thiết dùng từng giá trị trong `facets.weight` (có thể input số).

---

## 8. Business Rules

| # | Rule | Chi tiết |
|---|------|----------|
| BR-01 | **Distinct từ data thực** | Không hardcode enum |
| BR-02 | **Weight cap 200** | SQL LIMIT — có thể cắt tail values hiếm |
| BR-03 | **No counts** | UI không hiện “(n)” |
| BR-04 | **Stale 10 phút FE** | Facet ít đổi khi admin thêm SKU mới — user có thể thấy delay |

---

## 9. Edge Cases

| Case | Hành vi |
|------|---------|
| Không có variation nào có `processor` | `processor: []` |
| `specs` không có key weight | `weight: []` |
| DB không PostgreSQL JSONB | Weight query fail → `[]` |
| Giá trị trùng sau trim | DISTINCT SQL xử lý |

---

## 10. Related Features

| FR | Quan hệ |
|----|---------|
| `FR_ViewProductListV2.md` | Consumer của facet values |
| `master_specification.md` §9.2 | Catalog API |

---

## 11. Source Files

| Layer | File |
|-------|------|
| Route | `server/routes/productRoutes.js` L8 |
| Controller | `server/controllers/productController.js` → `getProductFacets` |
| Model | `ProductVariation`, `Product.specs` |
| FE | `client/app/hooks/useProducts.js`, `HomePage.jsx` |

---

## 12. Acceptance Criteria

- **AC1:** GET 200 với 6 keys trong `facets`.
- **AC2:** Mỗi mảng chỉ string không rỗng, sorted.
- **AC3:** Giá trị variation facet khớp dữ liệu `product_variations` trong DB.
- **AC4:** Chọn processor trên FE → v2 request có `processor=` và kết quả lọc đúng.
- **AC5:** Lỗi SQL weight không làm 500 toàn endpoint.
