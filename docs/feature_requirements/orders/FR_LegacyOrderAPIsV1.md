# Functional Requirement (FR) — Legacy Order APIs V1

## 1. Feature Overview

Dự án có **hai thế hệ** logic đơn hàng phía backend:

| Thế hệ | Trạng thái route | Handler |
|--------|------------------|---------|
| **V2 (đang dùng)** | Mount trên `orderRoutes.js` | `getUserOrdersV2`, `getOrderCountersV2` |
| **V1 (legacy)** | **Không mount** — code còn trong controller | `getUserOrders`, `getOrderCounters` |

Ngoài ra, lớp **`ordersAPI` trong `api.js`** và hook **`useOrders` (comment cũ)** phản ánh contract V1 đơn giản (không tabs), trong khi UI production dùng V2 qua React Query.

Tài liệu này mô tả **API/logic legacy còn trong repo**, so sánh V2, và rủi ro nếu ai đó mount lại hoặc gọi nhầm wrapper cũ.

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Maintainer** | Refactor / dọn dead code |
| **orderController** | Chứa song song V1 + V2 |
| **ordersAPI (FE)** | Wrapper ít dùng |
| **useOrders hook** | Chỉ gọi V2; block comment V1 |

---

## 3. Scope

### In Scope

- `getUserOrders` vs `getUserOrdersV2`.
- `getOrderCounters` vs `getOrderCountersV2`.
- `GET /orders/:id` full detail vs slim (FE production dùng slim).
- `ordersAPI.getOrders()` / `getOrderById()` không params.
- Commented code trong `useOrders.js`.

### Out of Scope

- Admin order APIs (`/api/admin/orders`).
- `POST /vnpay/create_payment_url` standalone (song song create order).

---

## 4. Route Map (hiện tại — V2 active)

File: `server/routes/orderRoutes.js`

| Method | Path | Handler | Ghi chú |
|--------|------|---------|---------|
| POST | `/` | `createOrder` | |
| GET | `/counters` | **getOrderCountersV2** | Không phải V1 |
| POST | `/:order_id/payment-method` | `changePaymentMethod` | |
| PUT | `/:order_id/shipping-address` | `updateShippingAddress` | |
| GET | `/` | **getUserOrdersV2** | Không phải V1 |
| GET | `/:order_id` | `getOrderDetail` | Full Sequelize JSON |
| POST | `/:order_id/cancel` | `cancelOrder` | |
| POST | `/preview` | `previewOrder` | |
| GET | `/:order_id/slim` | `getOrderDetailSlim` | FE detail |
| POST | `/:order_id/payments/retry` | `retryVnpayPayment` | |

**V1 `getUserOrders` / `getOrderCounters`:** export trong controller nhưng **không có route**.

---

## 5. Legacy — `getUserOrders` (V1)

### Query params (giống V2 surface)

`tab`, `page`, `limit`, `q`, `sort` — cùng tên.

### Khác biệt quan trọng so V2

| Khía cạnh | V1 | V2 |
|-----------|----|----|
| Tab `to_ship` | Chỉ `where.status = processing` | Thêm filter payment: COD pending **hoặc** VNPAY completed |
| Tab `shipping` | Chỉ `status = shipping` | Thêm filter payment OR như trên |
| Tab `awaiting_payment` | Set `paymentWhere` trên include | `required: true` + where VNPAY pending |
| Search `q` | Chỉ `order_code iLike` | `order_code` **hoặc** `product_name` qua join |
| `OrderItem` include | Không `required: true` | `required: true` |
| `subQuery` | Không set `subQuery: false` | `subQuery: false` |

**Hệ quả V1:** Tab "Chờ giao hàng" có thể hiện đơn VNPAY **chưa** thanh toán (`processing` + payment pending) — sai nghiệp vụ so thiết kế V2.

Comment trong V1 (L612–616) thừa nhận OR payment khó làm một include → "lọc sau bằng JS" nhưng **không implement** filter JS trong response.

---

## 6. Legacy — `getOrderCounters` (V1)

| Key | V1 logic | V2 logic |
|-----|----------|----------|
| `to_ship` | Mọi `processing` → +1 | Chỉ khi payment thỏa COD pending / VNPAY completed |
| `shipping` | Mọi `shipping` | + payment OR |
| `awaiting_payment` | Tương tự V2 | Giống |
| `delivered` | `delivered` + payment completed | Giống |

Route mount **V2** → badge tab trên FE đúng theo V2.

---

## 7. Legacy — Frontend `ordersAPI`

```javascript
// client/app/services/api.js
export const ordersAPI = {
  createOrder: (data) => api.post("/orders", data),
  getOrders: () => api.get("/orders"),           // ❌ không truyền tab/page/q
  getOrderById: (id) => api.get(`/orders/${id}`), // ❌ full, không slim
};
```

| Method | Vấn đề |
|--------|--------|
| `getOrders()` | Luôn tab `all`, page 1 — không khớp `OrdersPage` |
| `getOrderById` | Full payload; `OrderDetailPage` dùng `useOrder` → `/slim` |

Grep codebase: **không** thấy component import `ordersAPI.getOrders` — dead wrapper tiềm năng.

---

## 8. Legacy — `useOrders` commented block

```javascript
// useOrders.js (commented)
// queryKey: ["orders"]
// api.get("/orders")  // không params
```

Hook active:

```javascript
api.get("/orders", { params }); // V2 contract
```

---

## 9. Full detail API vs Slim (liên quan legacy adoption)

| Endpoint | Dùng bởi |
|----------|----------|
| `GET /orders/:id` | `ordersAPI.getOrderById` (legacy) |
| `GET /orders/:id/slim` | `useOrder` → `OrderDetailPage` |

Xem `FR_ViewOrderDetail` / `FR_ViewOrderDetailSlim` trong cùng thư mục.

---

## 10. Migration / Deprecation khuyến nghị

1. Xóa hoặc `@deprecated` `getUserOrders`, `getOrderCounters` nếu không có kế hoạch A/B.
2. Cập nhật `ordersAPI`: `getOrders(params)`, `getOrderById` → slim hoặc xóa export.
3. Document master spec chỉ V2 tab filters.
4. Nếu mount lại V1: phải đổi route name (`/orders/v1`) tránh nhầm production.

---

## 11. Related FRs

| FR | Liên kết |
|----|----------|
| `FR_ViewUserOrders` | V2 list |
| `FR_ViewOrderTabCounters` | V2 counters |
| `FR_ViewOrderDetail` | Full GET |

---

## 12. Source Files

| File | Vai trò |
|------|---------|
| `server/controllers/orderController.js` | V1 + V2 handlers |
| `server/routes/orderRoutes.js` | Chỉ mount V2 |
| `client/app/services/api.js` | `ordersAPI` legacy |
| `client/app/hooks/useOrders.js` | V2 + comment V1 |
| `docs/master_specification.md` §9.4 | Catalog (không phân V1/V2) |

---

## 13. Acceptance Criteria (audit)

- [ ] Không route nào trỏ `getUserOrders` / `getOrderCounters` V1.
- [ ] `OrdersPage` chỉ gọi GET `/orders` với `tab`, `page`, `q`.
- [ ] `GET /counters` trả counters theo logic V2 (`to_ship` ⊆ `processing`).
- [ ] Biết rõ `ordersAPI.getOrders()` không dùng trong UI chính.

---

## 14. Known Gaps

| # | Mô tả |
|---|--------|
| GAP-01 | Dead code V1 ~150+ dòng — tăng nợ bảo trì. |
| GAP-02 | `ordersAPI` misleading cho dev mới. |
| GAP-03 | Master spec không ghi "V2 only". |
| GAP-04 | V1 search không tìm tên sản phẩm — regress nếu mount nhầm. |
