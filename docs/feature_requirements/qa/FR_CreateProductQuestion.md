# Functional Requirement (FR) — Tạo câu hỏi theo sản phẩm (Create Product Question)

## 1. Feature Overview

User đăng nhập đặt câu hỏi trên **trang chi tiết sản phẩm** (PDP), hoặc gửi **follow-up** một cấp sau khi câu gốc đã được trả lời.

```
POST /api/products/:id/questions
Authorization: Bearer JWT
Body: { "question_text": "...", "parent_question_id": <optional> }
```

`:id` = `product_id` (số) hoặc `slug`.

**FE:** `ProductDetailPage.postQuestion` (câu gốc) và inline POST follow-up trong khối Q&A.

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Customer (logged in)** | Đặt câu / follow-up (nếu owner) |
| **Guest** | Chỉ xem; nút gửi disabled |
| **createQuestion** | `productController.createQuestion` |

---

## 3. Scope

### In Scope

- Resolve product bằng id hoặc slug.
- Câu hỏi gốc: `parent_question_id = null`.
- Follow-up: 1 cấp, parent phải đã có answer, cùng product.
- 409 nếu parent đã có follow-up (unique DB).

### Out of Scope

- Tạo câu không qua product (dùng `FR_CreateGlobalQuestion`).
- Staff tạo câu thay khách.
- Edit/delete question (controller có, route chưa — `FR_UpdateDeleteProductQuestion`).

---

## 4. API Contract

### 4.1 Câu hỏi gốc

```http
POST /api/products/acer-swift-3/questions
Authorization: Bearer <token>

{
  "question_text": "Máy có bàn phím tiếng Việt không?"
}
```

### 4.2 Follow-up

```http
POST /api/products/10/questions

{
  "question_text": "Cảm ơn, vậy bảo hành bao lâu?",
  "parent_question_id": 42
}
```

### Response — 201

```json
{
  "question": {
    "question_id": 43,
    "question_text": "...",
    "is_answered": false,
    "created_at": "...",
    "parent_question_id": 42,
    "user": { "user_id", "username", "full_name" }
  }
}
```

### Errors

| HTTP | Message |
|------|---------|
| 400 | `question_text is required` |
| 400 | `Only one follow-up level is allowed` |
| 400 | `Parent question does not belong to this product` |
| 400 | `Parent must be answered before follow-up` |
| 404 | `Product not found` / `Parent question not found` |
| 409 | `This question already has a follow-up` |
| 401 | JWT |

---

## 5. Backend Logic

### Resolve product

```javascript
const whereKey = /^\d+$/.test(String(id))
  ? { product_id: id }
  : { slug: id };
```

### Follow-up validation

```mermaid
flowchart TD
  A[parent_question_id?] -->|No| B[Create root question]
  A -->|Yes| C{Parent exists?}
  C -->|No| E404
  C -->|Yes| D{Parent is root?}
  D -->|No| E400 one level
  D -->|Yes| E{Same product?}
  E -->|No| E400
  E -->|Yes| F{Parent has answer?}
  F -->|No| E400 must answered
  F -->|Yes| G[Create child]
```

| # | Rule |
|---|------|
| BR-01 | Parent phải **root** (`parent.parent_question_id` falsy) |
| BR-02 | Parent phải có **ít nhất một** row `answers` |
| BR-03 | Comment trong code: chỉ owner parent follow-up — **đang tắt** |
| BR-04 | `is_answered: false` khi tạo |
| BR-05 | Sequelize unique trên `parent_question_id` → 409 |

### Create row

```javascript
Question.create({
  product_id: product.product_id,
  user_id: req.user.user_id,
  question_text: question_text.trim(),
  is_answered: false,
  parent_question_id: parent_question_id || null,
});
```

---

## 6. Frontend — ProductDetailPage

### Câu gốc

```javascript
POST /api/products/${id}/questions
body: { question_text: questionText.trim() }
// success: window.location.reload()
```

| # | UX |
|---|-----|
| BR-06 | `disabled={!isAuthed \|\| !questionText.trim()}` |
| BR-07 | Reload full page — **không** refetch `useProduct` |

### Follow-up

```javascript
canShowFollowUp(q) =>
  isAuthed &&
  q.is_answered &&
  (q.children?.length || 0) === 0 &&
  q.user?.user_id === currentUserId;
```

```javascript
POST /api/products/${id}/questions
body: { question_text, parent_question_id: q.question_id }
```

| # | UX |
|---|-----|
| BR-08 | Chỉ owner câu gốc (so `currentUserId` từ Redux/localStorage) |
| BR-09 | Hint UI: “Chỉ 1 follow-up; sau khi câu gốc đã được trả lời” |
| BR-10 | Lỗi hiển thị `alert(e.message)` |

### `currentUserId`

```javascript
const currentUser = useSelector(s => s.auth?.user) || JSON.parse(localStorage.getItem("user"));
const currentUserId = currentUser?.user_id ?? null;
```

---

## 7. Hiển thị sau tạo

- Câu gốc: nằm trong `product.questions` sau reload (`getProductDetail` embedded).
- Follow-up: nested `q.children[]` trên PDP.
- Câu gốc có thể xuất hiện trên **trang chủ** (`FR_ListGlobalQuestions`) vì feed lấy mọi root question.

---

## 8. Related FRs

| FR | Liên kết |
|----|----------|
| `FR_ListProductQuestionsEmbedded` | Load Q&A sau reload |
| `FR_StaffAnswerOnProductPage` | Parent cần answer trước follow-up |
| `FR_GetProductQuestionsStandalone` | API list riêng (chưa mount) |
| `FR_ListGlobalQuestions` | Feed trang chủ |

---

## 9. Source Files

| File | Vai trò |
|------|---------|
| `server/controllers/productController.js` | `createQuestion` |
| `server/routes/productRoutes.js` | `POST /:id/questions` |
| `client/app/pages/ProductDetailPage.jsx` | UI |
| `server/models/Question.js` | Schema + self-ref |

---

## 10. Acceptance Criteria

- [ ] POST câu gốc với slug/id hợp lệ → 201.
- [ ] Guest không gửi được (UI + 401).
- [ ] Follow-up khi parent chưa answered → 400.
- [ ] Follow-up thứ hai cùng parent → 409.
- [ ] Follow-up của follow-up → 400 one level.
- [ ] FE owner thấy form follow-up sau khi staff trả lời (`is_answered`).

---

## 11. Known Gaps

| # | Mô tả |
|---|--------|
| GAP-01 | Reload thay vì invalidate `useProduct` — UX chậm |
| GAP-02 | BE không enforce “chỉ owner follow-up”; FE có |
| GAP-03 | `getProductDetail` chỉ load root + children — follow-up không có answers include riêng trong children block (chỉ question_text) |
| GAP-04 | Staff không tạo câu hộ khách trên PDP |
