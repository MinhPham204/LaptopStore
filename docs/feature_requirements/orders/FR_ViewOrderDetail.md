# Functional Requirement (FR) — Chi tiết đơn hàng đầy đủ (View Order Detail)

## 1. Feature Overview

API trả về **bản ghi Order Sequelize đầy đủ** (JSON `toJSON`) kèm quan hệ `items` → `variation` → `product` và `payment`:

```
GET /api/orders/:order_id
Authorization: Bearer <JWT>
```

**Handler:** `getOrderDetail`.  
**Lưu ý triển khai FE:** Trang khách hàng **không dùng** endpoint này — `useOrder` gọi `/slim` (xem `FR_ViewOrderDetailSlim`). Endpoint vẫn tồn tại cho client khác / `api.getOrderById` / tích hợp tương lai.

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Authenticated Customer** | Chủ đơn |
| **orderController.getOrderDetail** | Read-only |
| **api.js** | `getOrderById(id)` wrapper (ít gọi) |

---

## 3. Scope

### In Scope

- Chỉ đơn thuộc `req.user.user_id`.
- Include đầy đủ nested associations.
- 404 nếu không tồn tại hoặc không thuộc user.

### Out of Scope

- Chuẩn hóa field như slim.
- Admin detail (`GET /api/admin/orders/:id`).

---

## 4. API Contract

### Request

- Path: `order_id` (integer PK).

### Response — 200

```json
{
  "order": {
    "order_id": 1,
    "order_code": "ORD-...",
    "user_id": 5,
    "total_amount": "25000000.00",
    "discount_amount": "2500000.00",
    "shipping_fee": "30000.00",
    "final_amount": "22530000.00",
    "status": "processing",
    "shipping_address": "...",
    "shipping_phone": "...",
    "shipping_name": "...",
    "note": "",
    "reserve_expires_at": "2026-05-28T10:00:00.000Z",
    "province_id": 79,
    "ward_id": 12345,
    "geo_lat": "10.776889",
    "geo_lng": "106.700806",
    "created_at": "...",
    "updated_at": "...",
    "items": [
      {
        "order_item_id": 1,
        "variation_id": 10,
        "quantity": 1,
        "price": "25000000.00",
        "discount_amount": "2500000.00",
        "subtotal": "22500000.00",
        "variation": {
          "variation_id": 10,
          "product": { "product_name": "...", ... }
        }
      }
    ],
    "payment": {
      "payment_id": 1,
      "provider": "VNPAY",
      "payment_method": "VNPAYQR",
      "payment_status": "pending",
      "amount": "22530000.00",
      "txn_ref": "1-1710000000000",
      ...
    }
  }
}
```

Shape phụ thuộc Sequelize — DECIMAL có thể là string; nested `variation` đầy đủ model fields.

### Errors

| HTTP | Message |
|------|---------|
| 404 | `Order not found` |
| 401 | Unauthorized |

---

## 5. Business Rules

| # | Rule |
|---|------|
| BR-01 | `where: { order_id, user_id: req.user.user_id }` — dùng `req.user` (không phải `req.userId`) |
| BR-02 | Không filter theo status — mọi trạng thái đều xem được nếu là chủ đơn |
| BR-03 | `OrderItem` include `variation` + `product` alias `product` |
| BR-04 | `Payment` as `payment` — có thể null nếu data lỗi (edge) |

---

## 6. So sánh với Slim

| Khía cạnh | Full (`GET /:id`) | Slim (`GET /:id/slim`) |
|-----------|-------------------|------------------------|
| FE OrderDetailPage | Không dùng | **Dùng** |
| Chuẩn hóa số | Không | `Number(...)` |
| `items[].product` | Nested variation tree | Flat `{ product_id, product_name, thumbnail_url, slug }` |
| `reserve_expires_at` | Có trong model JSON | **Thiếu** trong slim payload (GAP) |
| Kích thước response | Lớn hơn | Nhỏ hơn |

---

## 7. Route Ordering

`GET /:order_id` phải đăng ký **sau** `GET /counters`.  
`GET /orders/counters` không bị nuốt bởi `:order_id`.

---

## 8. Related FRs

| FR | Liên kết |
|----|----------|
| `FR_ViewOrderDetailSlim` | FE production path |
| `FR_ViewUserOrders` | Điều hướng từ list |
| `FR_CancelOrder` | Hành động trên detail (slim data) |

---

## 9. Source Files

| Layer | File |
|-------|------|
| Route | `server/routes/orderRoutes.js` |
| Controller | `orderController.js` — `getOrderDetail` |
| FE API | `client/app/services/api.js` — `getOrderById` |
| Spec | `docs/master_specification.md` §9.4 |

---

## 10. Acceptance Criteria

- [ ] User A không xem được `order_id` của User B → 404.
- [ ] Response có `items` và `payment` khi DB đầy đủ.
- [ ] Postman gọi `GET /orders/:id` hoạt động độc lập slim.

---

## 11. Known Gaps

| # | Mô tả |
|---|--------|
| GAP-01 | FE ưu tiên slim — full API có thể **stale** so với UI cần. |
| GAP-02 | `getOrderDetail` vs `getOrderDetailSlim` dùng `req.user.user_id` vs cùng — thống nhất nhưng khác `getUserOrdersV2` dùng `req.userId`. |
| GAP-03 | Master spec ghi OrderDetailPage "Public*" — API vẫn bắt JWT. |
| GAP-04 | Không có versioning — mobile app mới nên chọn slim hoặc full một chuẩn. |
