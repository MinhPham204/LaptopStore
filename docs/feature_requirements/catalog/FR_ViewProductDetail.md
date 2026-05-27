# Functional Requirement (FR) — Xem chi tiết sản phẩm (View Product Detail)

## 1. Feature Overview

API **`GET /api/products/:id`** trả về **một sản phẩm đầy đủ**: thông tin cơ bản, `specs` JSONB, category, brand, **tất cả biến thể (SKU)**, gallery ảnh, tags, cây **Q&A** (câu hỏi gốc + follow-up + answers). Tham số `:id` chấp nhận **`product_id` số** hoặc **`slug` chuỗi**.

Frontend: route **`/products/:id`** → `ProductDetailPage.jsx` → hook `useProduct(id)`.

Side effects: **`view_count++`** (xem `FR_IncrementProductViewCount.md`). Gợi ý sản phẩm dùng API **riêng** theo `variation_id` (KNN proxy), không nằm trong response detail.

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Guest / Customer** | Xem SP, chọn cấu hình, thêm giỏ, so sánh, hỏi đáp |
| **Authenticated User** | POST câu hỏi (`POST /:id/questions`) — ngoài scope GET detail |
| **Staff** | Trả lời Q&A qua endpoint khác |

---

## 3. Scope

### In Scope (GET detail)

- Resolve id/slug.
- Eager load: Category, Brand, ProductVariation, ProductImage, Tag, Question tree.
- Sort ảnh `display_order`; Q&A theo quy tắc nested order.
- Chuẩn hóa `specs` null → `{}`.
- Tính `primaryVariationId` nếu thiếu.
- Increment `view_count`.

### Out of Scope (cùng trang FE nhưng API khác)

- `GET /variations/:id/recommendations` — KNN.
- `GET/POST /compare`.
- `POST /:id/questions`, `POST /questions/:id/answers`.
- Admin update product.

---

## 4. Preconditions

- Product tồn tại với id hoặc slug khớp.
- Associations Sequelize (`as: "category"`, `"brand"`, `"variations"`, …) khai báo trong `models/index.js`.

---

## 5. API Contract

### Endpoint

```
GET /api/products/:id
```

**Auth:** Public.

**`:id` resolution:**

```javascript
const whereKey = isNaN(Number(id)) ? { slug: id } : { product_id: id };
```

| Input ví dụ | Where |
|-------------|-------|
| `42` | `product_id = 42` |
| `macbook-pro-m3` | `slug = 'macbook-pro-m3'` |

### Response — 200 OK

```json
{
  "product": {
    "product_id": 1,
    "product_name": "...",
    "slug": "...",
    "description": "...",
    "category_id": 1,
    "brand_id": 2,
    "discount_percentage": "10.00",
    "thumbnail_url": "...",
    "is_active": true,
    "view_count": 123,
    "rating_average": "4.50",
    "review_count": 0,
    "specs": { "weight": "1.8kg", "General": [...] },
    "category": { ... },
    "brand": { ... },
    "variations": [
      {
        "variation_id": 10,
        "price": "25000000",
        "stock_quantity": 5,
        "is_available": true,
        "is_primary": true,
        "processor": "i7",
        "ram": "16GB",
        "storage": "512GB",
        "graphics_card": "RTX 4060",
        "screen_size": "15.6",
        "color": "Gray"
      }
    ],
    "images": [{ "image_url": "...", "display_order": 0, ... }],
    "Tags": [],
    "questions": [
      {
        "question_id": 1,
        "question_text": "...",
        "is_answered": true,
        "user": { "username": "..." },
        "answers": [...],
        "children": [...]
      }
    ],
    "primaryVariationId": 10
  }
}
```

### Response — 404

```json
{ "message": "Product not found" }
```

---

## 6. Includes & Ordering

### Variations

- `required: false` — SP không có variation vẫn trả về.
- Comment code: có thể bật `where: { is_available: true }` — **hiện tắt** → trả cả SKU hết hàng.

### Images

- Order: `images.display_order ASC`.

### Questions

- Chỉ **câu hỏi gốc**: `where: { parent_question_id: null }`.
- Include `children` (follow-up 1 cấp), `answers`, user.
- Order phức tạp: gốc `created_at DESC`, answers `ASC`, children `ASC`.

### Attributes

- Explicit `include: ["specs", "is_active"]` trên Product (ngoài default).

---

## 7. Post-processing (`primaryVariationId`)

Nếu response chưa có `primaryVariationId` và có `variations`:

Sort variations: `is_primary DESC` → `stock_quantity DESC` → `price ASC` → lấy `variation_id` đầu.

FE `ProductDetailPage` cũng chọn variation theo `sel` (processor, ram, …) và state `selectedVariation`.

---

## 8. Frontend — `ProductDetailPage.jsx`

| Chức năng | Chi tiết |
|-----------|----------|
| Route param | `useParams().id` — slug hoặc id |
| Data | `useProduct(id)` → `productData.product` |
| Gallery | Merge `thumbnail_url` + `images` |
| Giá | `variation.price` × `(1 - discount_percentage/100)` |
| Chọn SKU | State `sel` theo ATTRS; `selectedVariation` |
| Add to cart | `useAddToCart` + `variation_id` |
| Compare | Redux `compareSlice` |
| Specs | `SpecsTable`, `SpecsModal` từ `product.specs` |
| Q&A UI | Render `product.questions`; POST qua fetch/API riêng |
| Recommendations | `useRecommendedByVariation(selectedVariation?.variation_id)` |

**Loading / error:** `LoadingSpinner`, thông báo khi `error` hoặc không có product.

---

## 9. Business Rules

| # | Rule | Chi tiết |
|---|------|----------|
| BR-01 | **Slug hoặc id** | URL thân thiện SEO (`/products/dell-xps-15`) |
| BR-02 | **View count** | Mỗi GET thành công +1 (best-effort) |
| BR-03 | **Q&A 2 cấp** | Gốc + children; tạo follow-up có rule riêng ở POST |
| BR-04 | **Không filter is_active** trên GET | SP inactive vẫn có thể xem (admin/legacy) |
| BR-05 | **Giá thực tế ở variation** | `base_price` có thể xuất hiện ở FE fallback nhưng giá SKU ở `variations[].price` |

---

## 10. Route ordering warning

Trong `productRoutes.js`, `GET /:id` đăng ký **trước** `GET /variations/.../recommendations` và `GET /compare`. Request tới `/products/variations/5/recommendations` có thể bị match `id = "variations"` nếu không sửa thứ tự route — **known deployment risk** (recommendations nên đăng ký trước `/:id`).

---

## 11. Related Features

| FR | Quan hệ |
|----|---------|
| `FR_IncrementProductViewCount.md` | Side effect |
| `FR_SearchSuggestions.md` | Navigate `handleSuggestionClick(slug)` |
| `FR_ViewProductListV2.md` | `ProductCard` link tới detail |
| Recommendation service | Proxy KNN |

---

## 12. Source Files

| Layer | File |
|-------|------|
| Route | `server/routes/productRoutes.js` L19 |
| Controller | `server/controllers/productController.js` → `getProductDetail` |
| Models | `Product`, `ProductVariation`, `ProductImage`, `Question`, `Answer`, … |
| FE | `client/app/pages/ProductDetailPage.jsx` |
| FE hook | `client/app/hooks/useProducts.js` → `useProduct` |

---

## 13. Acceptance Criteria

- **AC1:** GET bằng slug hợp lệ → 200 + `product.slug` khớp.
- **AC2:** GET bằng `product_id` → 200.
- **AC3:** Slug/id sai → 404.
- **AC4:** Response có `variations`, `images`, `questions` (có thể rỗng).
- **AC5:** `specs` không bao giờ null trong JSON (object rỗng tối thiểu).
- **AC6:** `view_count` tăng sau request (kiểm tra DB).
- **AC7:** FE render giá và chọn biến thể từ payload.
