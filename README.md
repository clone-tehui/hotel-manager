# Hotel Management System (ChiHome PMS)

Hệ thống quản lý đặt phòng lưu trú chuyên nghiệp (PMS nội bộ) cho ChiHome, thiết kế với giao diện thân thiện (UX Desktop-first) và tích hợp các tính năng cốt lõi cho nghiệp vụ khách sạn/căn hộ dịch vụ.

## 🚀 Công nghệ sử dụng
- **Monorepo**: pnpm workspace
- **Backend**: NestJS, PostgreSQL, Prisma ORM, JWT Auth, Swagger
- **Frontend**: Next.js 14, TypeScript, Material UI (MUI), TanStack Query
- **Tích hợp**: Webhook Outbound (n8n), Export Excel/CSV, OTA Connectors, AI CEO Agent (OpenRouter)

## ✨ Tính năng chính
- **Quản lý phòng/căn hộ**: rooms, room types, buildings, giá phòng (`price`, `discountablePrice`)
- **Đặt phòng & Timeline**: booking, reservations, timeline trực quan theo Ngày/Tuần/Tháng (giống ezCloud)
- **Dashboard**: công suất, tình trạng vận hành, **tỷ lệ lấp đầy (occupancy)** theo tuần/tháng/quý
- **Business Truth**: tính toán occupancy rate, doanh thu theo đêm, break-even theo chi phí vận hành tháng (múi giờ VN)
- **AI CEO Agent**: phân tích và đề xuất chiến dịch lấp đầy phòng theo từng phòng/kỳ (advisory/read-only, cần quản lý duyệt)
- **OTA Connectors**: khung quản lý kênh OTA (Airbnb...) — lưu credential mã hoá AES-256-GCM, audit trail; **chưa có adapter thực thi** (fails closed)
- **Import Excel booking**: mapping `Phòng`, `Tên khách`, `Ngày đến/Ngày đi`, `NL/TE`, `Loại giá`, `Ghi chú`; skip conflict/trùng, không overwrite booking hiện có
- **Export Excel/CSV** báo cáo theo bộ lọc hiện tại
- **Webhook Outbound (n8n)**: gửi event khi tạo/sửa booking, đổi phòng, check-in/check-out; retry tối đa 3 lần exponential backoff
- **RBAC**: `ADMIN` / `MANAGER` / `RECEPTIONIST`

---

## ⚙️ Hướng dẫn cài đặt & chạy

### Cách 1: Chạy bằng Docker Compose (khuyến nghị)

Tạo file `.env` ở thư mục gốc (dựa trên `.env.example`):
```env
POSTGRES_USER=hotel_user
POSTGRES_PASSWORD=change-me
POSTGRES_DB=hotel_db
DATABASE_URL=postgresql://hotel_user:change-me@db:5432/hotel_db
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_API_URL=http://localhost:3001
# Tuỳ chọn (AI CEO Agent)
OPENROUTER_API_KEY=
AI_CEO_WORKER_ENABLED=false
```

Khởi chạy toàn bộ (PostgreSQL + API + Web):
```bash
docker compose up -d --build
```

Sau khi khởi động, chạy migration + seed (tạo dữ liệu mẫu):
```bash
docker compose exec api pnpm db:migrate
docker compose exec api pnpm db:seed
```

Truy cập:
- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **Swagger**: http://localhost:3001/api/docs
- **Health**: http://localhost:3001/api/health

> Lưu ý: Compose dùng network riêng `hotel_network`, không đụng các container khác (ví dụ n8n). Port DB `5433`, API `3001`, Web `3000` chỉ bind trên loopback (`127.0.0.1`).

### Cách 2: Chạy Local (dev)

**1. Cài dependencies:**
```bash
npm install -g pnpm
pnpm install
```

**2. Thiết lập Environment Variables:**

Backend (`apps/api/.env`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hotel_db?schema=public"
JWT_SECRET="super-secret-key-change-me-in-production"
JWT_EXPIRES_IN="7d"
OPENROUTER_API_KEY=""        # bật AI CEO Agent
AI_CEO_WORKER_ENABLED=false
```

Frontend (`apps/web/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**3. Khởi tạo Database (Migration & Seed):**
Cần PostgreSQL đang chạy (có thể dùng `docker compose up -d db`). Chạy tại root:
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```
*Seed tạo sẵn tài khoản Admin/Manager/Receptionist, Phòng, Khách hàng, Webhook và Booking mẫu.*

**4. Khởi chạy hệ thống:**
```bash
pnpm dev
```
Hoặc chạy riêng:
- **Backend:** `cd apps/api && pnpm dev` (cổng 3001)
- **Frontend:** `cd apps/web && pnpm dev` (cổng 3000)

**5. Swagger API Docs:** http://localhost:3001/api/docs

---

## 🎯 Tài khoản mặc định (seed)

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| Admin | `admin@opera.vn` | `Admin@123` |
| Manager | `manager@opera.vn` | (xem seed) |
| Receptionist | `letan@opera.vn` | (xem seed) |

> ⚠️ Đổi mật khẩu ngay khi triển khai production.

---

## 🎯 Cách demo trong 5 phút

1. Mở trình duyệt, truy cập http://localhost:3000
2. Đăng nhập với tài khoản Admin ở trên.
3. **Dashboard:** Xem công suất, tình trạng vận hành, **tỷ lệ lấp đầy** theo tuần/tháng/quý.
4. **Timeline:** Xem biểu đồ đặt phòng trực quan theo Ngày/Tuần/Tháng.
5. **Thao tác nhanh:**
   - Bấm vào dải màu đặt phòng để xem chi tiết (Drawer bên phải).
   - Bấm vào ô trống trên lưới để tạo đặt phòng mới (Quick Create).
6. **Menu Quản lý:** Chuyển qua các tab "Phòng", "Loại phòng", "Khách hàng" để xem CRUD.

---

## 📊 Cách test tính năng Export (Excel/CSV)

1. Vào trang **Timeline**.
2. Chọn khoảng thời gian (Ví dụ: Tuần này).
3. Chọn bộ lọc trạng thái (Ví dụ: "Đang ở", "Sắp đến").
4. Nhấn nút **Xuất Excel** (hoặc Xuất CSV) ở góc trên bên phải.
5. Hệ thống áp dụng đúng bộ lọc hiện tại để xuất file.
6. Mở file, kiểm tra các cột: *Phòng, Tên khách, Ngày đến, Ngày đi, Loại giá...*

---

## 🤖 AI CEO Agent (advisory/read-only)

Phân tích dữ liệu vận hành thật và đề xuất chiến dịch lấp đầy phòng theo từng phòng/kỳ (Tuần này, Tuần sau, Tháng này, Tháng sau). **Chỉ tư vấn, không tự thay đổi giá/đặt phòng** — mọi hành động đều là PROPOSED và cần quản lý duyệt.

**Bật tính năng:**
- Set `OPENROUTER_API_KEY` trong `.env` (API key chỉ nằm ở environment, không lưu DB).
- Set `AI_CEO_WORKER_ENABLED=true` sau khi migration đã áp dụng và verify.

**API (cần JWT + role ADMIN):**
- `GET /api/ai-ceo-agent/status` — trạng thái runtime
- `GET /api/ai-ceo-agent/runs` — danh sách run
- `POST /api/ai-ceo-agent/run` — queue phân tích portfolio (async, trả 202)
- `POST /api/ai-ceo-agent/runs` — queue run tuỳ chỉnh (`periodKeys`, `roomIds`, `runMode`)
- `GET /api/ai-ceo-agent/runs/:id` — chi tiết run
- `POST /api/ai-ceo-agent/runs/:id/cancel` — huỷ run
- `GET /api/ai-ceo-agent/campaigns` — danh sách chiến dịch đề xuất
- `PATCH /api/ai-ceo-agent/campaigns/:id/status` — chuyển trạng thái chiến dịch
- `POST /api/ai-ceo-agent/campaigns/:id/measure` — đo lường kết quả so với baseline
- `POST /api/ai-ceo-agent/campaigns/:id/lesson` — tạo bài học từ kết quả đo
- `GET /api/ai-ceo-agent/memories` — bộ nhớ dài hạn
- `PATCH /api/ai-ceo-agent/memories/:id` — kiểm soát memory
- `POST /api/ai-ceo-agent/runs/:id/company-synthesis` — tổng hợp công ty
- `PATCH /api/ai-ceo-agent/config` — cấu hình model/runtime

**Chạy test nhanh:**
```bash
cd apps/api
pnpm test:ai-ceo
```

---

## 🔌 OTA Connectors

Khung quản lý kênh OTA (Airbnb...). Credential được mã hoá AES-256-GCM (khoá từ `JWT_SECRET`), có audit trail đầy đủ. **Hiện chưa có adapter thực thi** — mọi thao tác `execute` đều fails closed (chặn) cho tới khi có adapter được phê duyệt.

**API (cần JWT + role ADMIN):**
- `GET /api/ota-connectors` — danh sách connector
- `PATCH /api/ota-connectors/:channel` — cấu hình credential + bật/tắt
- `POST /api/ota-connectors/:id/preview` — validate trạng thái local (không gọi OTA)
- `POST /api/ota-connectors/:id/execute` — bị chặn (fails closed)
- `GET /api/ota-connectors/:id/audits` — audit trail

---

## 🔗 Cách test Webhook Outbound (n8n Integration)

Hệ thống gửi event sang hệ thống khác (như n8n) mỗi khi có sự kiện (tạo/sửa booking, đổi phòng...). Seed tạo sẵn webhook URL `http://localhost:5678/webhook/hotel-events`.

**Test nhanh payload:**
```bash
# Lấy Token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@opera.vn","password":"Admin@123"}' | jq -r .data.access_token)

# Trigger Test Webhook
curl -X POST http://localhost:3001/api/webhooks/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Xem logs delivery:**
```bash
curl -X GET http://localhost:3001/api/integrations/n8n/logs \
  -H "Authorization: Bearer $TOKEN"
```

**Test event thực:** lên Timeline, đổi trạng thái phòng (Check-in/Check-out) → hệ thống tự trigger event (ví dụ `reservation.checked_in`) và ghi log.

---

## 🧪 Chạy test

Tại `apps/api`:
```bash
pnpm test:ai-ceo          # toàn bộ test AI CEO Agent
pnpm test:ota-connectors  # test OTA connector policy
pnpm test:business-truth  # test business truth / occupancy
```

---

## 🔐 Bảo mật & Lưu ý

- **Không commit `.env`** — chỉ commit `.env.example` (đã có sẵn).
- **Không up database/data** lên repo — chỉ có `prisma/schema.prisma` (schema). Data thật nằm trên máy chủ.
- `JWT_SECRET` phải đổi thành giá trị mạnh riêng khi production.
- `OPENROUTER_API_KEY` chỉ nằm ở environment, không bao giờ lưu vào DB.
- OTA credential mã hoá bằng khoá dẫn xuất từ `JWT_SECRET` — nếu đổi `JWT_SECRET`, credential cũ sẽ không giải mã được.
- AI CEO Agent là advisory/read-only; không có tool thay đổi giá OTA.