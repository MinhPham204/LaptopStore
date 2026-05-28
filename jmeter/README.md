# JMeter Load Test — LaptopStore (Cách C)

Load test một file `.jmx` mô phỏng khách xem danh sách sản phẩm (HomePage) và gợi ý KNN trên trang chi tiết (PDP).

## Thông số đã confirm

| Hạng mục | Giá trị |
|----------|---------|
| Loại test | **Load** (`product-list-v2-load.jmx`) |
| Virtual users | **100** |
| Ramp-up | **60 giây** |
| Thời lượng (scheduler) | **600 giây (10 phút)** |
| Loop | Forever (-1) trong duration |
| On sample error | Continue |
| Traffic mix | **70%** danh sách v2, **30%** recommendations |
| HOST / PORT | Biến JMeter `${HOST}`, `${PORT}`; override CLI `-JHOST=`, `-JPORT=` |
| PORT mặc định | **5000** (hoặc `PORT` trong `server/.env` nếu có) |

### Endpoints (public, không JWT)

| Tỷ lệ | Sampler | Method & path |
|-------|---------|----------------|
| 70% | `01_ProductList_V2` | `GET /api/products/v2?page=1&limit=30` (không gửi `sort_by`) |
| 30% | `02_Recommendations_ByVariation` | `GET /api/products/variations/${variation_id}/recommendations` |

`variation_id` lấy từ `jmeter/data/variation_ids.csv` (CSV Data Set, recycle, share all threads).

### Assertions

| Sampler | HTTP | Thời gian tối đa |
|---------|------|------------------|
| `01_ProductList_V2` | 200 | ≤ 2000 ms |
| `02_Recommendations_ByVariation` | 200 | ≤ 5000 ms |

## Cài Apache JMeter (Windows)

Lỗi `jmeter : The term 'jmeter' is not recognized` nghĩa là **chưa cài JMeter** hoặc **chưa thêm `bin` vào PATH** — không phải lỗi project hay file `.jmx`.

1. Tải bản binary: [Apache JMeter — Download](https://jmeter.apache.org/download_jmeter.cgi) (ví dụ `apache-jmeter-5.6.3.zip`).
2. Giải nén, ví dụ `C:\tools\apache-jmeter-5.6.3`.
3. Cần **Java 8+** (`java -version`).
4. Chạy load test (một trong các cách):

```powershell
# Cach A: tham so -JmeterHome (khong can PATH)
.\jmeter\scripts\run-load-test.ps1 -JmeterHome C:\tools\apache-jmeter-5.6.3

# Cach B: bien moi truong session
$env:JMETER_HOME = "C:\tools\apache-jmeter-5.6.3"
$env:Path += ";$env:JMETER_HOME\bin"
cd jmeter
jmeter.bat -n -t product-list-v2-load.jmx -JHOST=localhost -JPORT=5000 -l results/load.jtl -e -o report/load
```

Trên Windows, lệnh thực tế là **`jmeter.bat`** trong thư mục `bin\`, không phải `jmeter` (trừ khi đã thêm PATH).

## Điều kiện chạy

1. **Node API** — từ thư mục `server/`:
   ```bash
   npm run dev
   ```
2. **Flask recommendation service** — bắt buộc cho sampler recommendations (`RECO_API_BASE` mặc định `http://127.0.0.1:8000` trong `server/controllers/productController.js`):
   ```bash
   cd recommendation_service
   python app.py
   ```
3. **Export CSV** `variation_id` từ DB (Neon qua `server/.env` — không commit file `.env`):
   ```bash
   node jmeter/scripts/export-variation-ids.js
   ```

## Cấu trúc thư mục

```
jmeter/
├── product-list-v2-load.jmx
├── data/variation_ids.csv
├── scripts/
│   ├── export-variation-ids.js
│   └── run-load-test.ps1
├── results/          # *.jtl (gitignore)
├── report/load/      # HTML report (gitignore)
└── README.md
```

## Lệnh chạy (repo root)

### PowerShell (khuyến nghị Windows)

```powershell
.\jmeter\scripts\run-load-test.ps1
# Buộc export lại CSV:
.\jmeter\scripts\run-load-test.ps1 -ExportCsv
# Override host/port:
.\jmeter\scripts\run-load-test.ps1 -HostName localhost -Port 5000
```

### CLI JMeter trực tiếp

Chạy từ thư mục `jmeter/` (để path CSV `data/variation_ids.csv` đúng):

```powershell
cd jmeter
jmeter -n -t product-list-v2-load.jmx `
  -JHOST=localhost -JPORT=5000 `
  -l results/load.jtl -e -o report/load
```

Hoặc từ repo root (chỉ định đường dẫn đầy đủ tới `.jmx`):

```powershell
jmeter -n -t jmeter/product-list-v2-load.jmx `
  -JHOST=localhost -JPORT=5000 `
  -l jmeter/results/load.jtl -e -o jmeter/report/load
```

> **Lưu ý:** File CSV trong JMX dùng path tương đối `data/variation_ids.csv` so với thư mục chứa file `.jmx`. Script `run-load-test.ps1` `cd` vào `jmeter/` trước khi chạy.

**Không** bật View Results Tree khi chạy CLI (tốn RAM). Có thể mở `product-list-v2-load.jmx` bằng GUI và dùng listener **Summary Report** (đã gắn, ghi chú GUI only). CLI dùng `-l` + `-e -o` để sinh báo cáo HTML.

## SLA gợi ý (báo cáo đồ án)

| Endpoint | Error rate | p95 latency |
|----------|------------|-------------|
| Product list v2 | &lt; 1% | &lt; 2 s |
| Recommendations | &lt; 2% | &lt; 4 s |

Đây là ngưỡng tham chiếu khi phân tích `load.jtl` / dashboard HTML — không phải assertion cứng trong JMX (assertion duration: 2s / 5s).

## Cảnh báo

- **Test trên localhost** bị giới hạn CPU/RAM máy dev; throughput và latency không đại diện production.
- Sampler **recommendations** gọi Node → proxy sang Flask; nếu Flask tắt sẽ lỗi 502/503 và tỷ lệ lỗi tăng.
- File `variation_ids.csv` placeholder (1–5) chỉ để smoke test; trước load thật hãy chạy `export-variation-ids.js`.

## Route order (`server/routes/productRoutes.js`)

Trong `productRoutes.js`, route `GET /:id` (`getProductDetail`) được khai báo **trước**:

```javascript
router.get("/:id", productController.getProductDetail)
router.get("/variations/:variation_id/recommendations", productController.getRecommendedByVariation);
```

Express khớp theo thứ tự đăng ký: request tới `/api/products/variations/10/recommendations` có thể bị `/:id` bắt với `id = "variations"` → 404 hoặc hành vi lạ. Unit test recommendations thường mount route riêng nên vẫn pass; **load test trên server thật** cần kiểm tra response 200. Nếu 404 hàng loạt ở sampler `02_Recommendations_ByVariation`, cân nhắc đổi thứ tự route (đặt `/variations/...` trước `/:id`) — ngoài phạm vi file JMeter này.

## Script export CSV

```bash
node jmeter/scripts/export-variation-ids.js
```

- Dùng `server/config/database` + model `ProductVariation` / `Product`.
- Lọc: `product_variations.is_available = true`, `products.is_active = true`.
- Ghi tối đa **50** `variation_id` → `jmeter/data/variation_ids.csv` (header: `variation_id`).
