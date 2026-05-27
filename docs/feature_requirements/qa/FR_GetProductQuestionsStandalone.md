# Functional Requirement (FR) — API danh sách Q&A sản phẩm độc lập (Get Product Questions — Standalone)

## 1. Feature Overview

Handler **`getProductQuestions`** trả về danh sách câu hỏi của **một sản phẩm** có **phân trang server**, include user + answers — **không** nested `children`, **không** lọc chỉ câu gốc.

**Trạng thái triển khai:** Code **đã có** trong `productController.js`; route **chưa đăng ký** trong `productRoutes.js`. Frontend hiện dùng Q&A **nhúng** trong `getProductDetail` (`FR_ListProductQuestionsEmbedded`).

**Gợi ý route khi bật:**

```http
GET /api/products/:id/questions?page=1&limit=10
```

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Client tương lai** | SPA/mobile load Q&A lazy |
| **getProductQuestions** | Handler sẵn có |
| **ProductDetailPage (hiện tại)** | **Không** gọi API này |

---

## 3. Scope

### In Scope (theo code controller)

- Resolve product: numeric `product_id` hoặc `slug`.
- `where: { product_id }` — **mọi** question row (gốc + follow-up flat).
- Pagination: `page`, `limit` (max 50).
- Include `user`, `answers` + user.

### Out of Scope (so với embedded)

- Nested `children`.
- Filter `parent_question_id IS NULL`.
- Bundle với giá, variations, images.

---

## 4. API Contract (intended)

### Request

```http
GET /api/products/acer-swift-3/questions?page=1&limit=10
```

| Param | Default | Mô tả |
|-------|---------|-------|
| `page` | 1 | ≥ 1 |
| `limit` | 10 | 1–50 |

### Response — 200

```json
{
  "questions": [
    {
      "question_id": 10,
      "question_text": "Có tặng chuột không?",
      "is_answered": true,
      "created_at": "...",
      "user": { "user_id", "username", "full_name" },
      "answers": [
        {
          "answer_id": 7,
          "answer_text": "...",
          "created_at": "...",
          "user": { ... }
        }
      ]
    },
    {
      "question_id": 11,
      "question_text": "Bảo hành chuột bao lâu?",
      "is_answered": false,
      "created_at": "...",
      "user": { ... },
      "answers": []
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  }
}
```

**Khác biệt:** Row `question_id: 11` có thể là follow-up (không có `parent_question_id` trong attributes response — **thiếu field** trong select).

### Errors

| HTTP | Message |
|------|---------|
| 404 | `Product not found` |

---

## 5. Backend Logic

```javascript
const whereKey = /^\d+$/.test(String(id))
  ? { product_id: id }
  : { slug: id };

Question.findAndCountAll({
  where: { product_id: product.product_id },
  attributes: ["question_id", "question_text", "is_answered", "created_at"],
  include: [User, Answer+User],
  order: [
    ["created_at", "DESC"],
    [{ model: Answer, as: "answers" }, "created_at", "ASC"],
  ],
  limit,
  offset: (page - 1) * limit,
});
```

| # | Rule |
|---|------|
| BR-01 | Comment trong file: *"FE đang lấy qua getProductDetail"* |
| BR-02 | Không `distinct: true` — count có thể lệch nếu join answers (tùy Sequelize) |
| BR-03 | **Không** trả `parent_question_id` — client khó group thread |

---

## 6. Route placement (đề xuất)

Thêm vào `productRoutes.js` **trước** hoặc **sau** `GET /:id` cần tránh conflict:

```javascript
// Option A — rõ ràng
router.get("/:id/questions", productController.getProductQuestions);

// Phải đặt SAU các path tĩnh: /facets, /v2, /questions (global)
// và có thể TRƯỚC hoặc SAU GET /:id tùy express matching
```

**Conflict check:**

- `GET /products/questions` → global list ✅
- `GET /products/123/questions` → standalone ✅
- `GET /products/123` → detail ✅

---

## 7. Khi nào nên dùng Standalone vs Embedded

| Use case | Khuyến nghị |
|----------|-------------|
| PDP load nhanh, Q&A lazy | Standalone + infinite scroll |
| Hiện trạng đồ án | Embedded — 1 request |
| Mobile app chỉ cần Q&A tab | Standalone |
| Thread follow-up UI | Embedded (có `children`) |

---

## 8. Frontend migration (nếu triển khai)

```javascript
// Ví dụ hook mới — chưa có trong repo
export function useProductQuestions(productId, page = 1) {
  return useQuery({
    queryKey: ["product-questions", productId, page],
    queryFn: () => api.get(`/products/${productId}/questions?page=${page}&limit=10`),
    enabled: !!productId,
  });
}
```

Cần FE logic group `parent_question_id` nếu API bổ sung field.

---

## 9. Related FRs

| FR | Liên kết |
|----|----------|
| `FR_ListProductQuestionsEmbedded` | Đang dùng thay thế |
| `FR_CreateProductQuestion` | Tạo xong cần refetch list hoặc detail |
| `FR_StaffAnswerOnProductPage` | Answer gắn `question_id` |

---

## 10. Source Files

| File | Vai trò |
|------|---------|
| `server/controllers/productController.js` | `getProductQuestions` L1046–1107 |
| `server/routes/productRoutes.js` | **Không có route** |
| `client/app/pages/ProductDetailPage.jsx` | Dùng embedded only |

---

## 11. Acceptance Criteria

**Hiện tại:**

- [ ] Gọi `GET /api/products/:id/questions` → **404** (route missing).
- [ ] PDP vẫn hoạt động qua embedded.

**Khi mount route:**

- [ ] Pagination đúng `totalPages`.
- [ ] Slug và numeric id resolve product.
- [ ] 404 product không tồn tại.
- [ ] Document rõ flat list vs nested embedded.

---

## 12. Known Gaps

| # | Mô tả | Đề xuất |
|---|--------|---------|
| GAP-01 | **Route chưa mount** | `router.get('/:id/questions', ...)` |
| GAP-02 | Thiếu `parent_question_id` trong attributes | Thêm field + filter query `roots_only=true` |
| GAP-03 | Trùng logic với embedded — drift risk | Extract shared query builder |
| GAP-04 | Không có FE consumer | Implement hook hoặc xóa dead code |
| GAP-05 | Follow-up hiển thị như câu riêng — UX thread hỏng nếu chỉ dùng standalone |
