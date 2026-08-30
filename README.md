# Hotel Management System (MVP)

Hệ thống quản lý đặt phòng lưu trú chuyên nghiệp, thiết kế với giao diện thân thiện (UX Desktop-first) và tích hợp các tính năng cốt lõi cho nghiệp vụ khách sạn.

## 🚀 Công nghệ sử dụng
- **Monorepo**: pnpm workspace
- **Backend**: NestJS, PostgreSQL, Prisma ORM, JWT Auth, Swagger
- **Frontend**: Next.js 14, TypeScript, Material UI (MUI), TanStack Query
- **Tích hợp**: Webhook Outbound (n8n), Export Excel/CSV

## ⚙️ Hướng dẫn cài đặt & chạy Local

### 1. Cài đặt Dependencies
Cài đặt pnpm (nếu chưa có) và tải các packages:
```bash
npm install -g pnpm
pnpm install
```

### 2. Thiết lập Environment Variables
Tạo file `.env` ở các thư mục tương ứng:

**Backend (`apps/api/.env`):**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hotel_db?schema=public"
JWT_SECRET="super-secret-key-change-me-in-production"
JWT_EXPIRES_IN="7d"
```

**Frontend (`apps/web/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Khởi tạo Database (Migration & Seed)
Cần có PostgreSQL đang chạy (có thể dùng docker-compose nếu có). Chạy các lệnh sau tại root:
```bash
cd apps/api
npx prisma migrate dev
npx ts-node prisma/seed.ts
```
*Lệnh seed sẽ tạo sẵn tài khoản Admin, Phòng, Khách hàng, Webhook và các Booking mẫu để test.*

### 4. Khởi chạy hệ thống
Có thể chạy song song cả Backend và Frontend từ thư mục gốc:
```bash
pnpm dev
```
Hoặc chạy riêng biệt:
- **Backend:** `cd apps/api && pnpm dev` (Chạy ở cổng 3001)
- **Frontend:** `cd apps/web && pnpm dev` (Chạy ở cổng 3000)

### 5. Swagger API Docs
Truy cập tài liệu API tự động tại: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

---

## 🎯 Cách demo trong 5 phút

1. Mở trình duyệt, truy cập [http://localhost:3000](http://localhost:3000)
2. Đăng nhập với tài khoản seed:
   - Dùng tài khoản quản trị được cấu hình riêng trong môi trường triển khai.
3. **Dashboard:** Xem số liệu thống kê tổng quan (phòng trống, đang ở, sắp đến).
4. **Timeline:** Xem biểu đồ đặt phòng trực quan theo Ngày/Tuần/Tháng.
5. **Thao tác nhanh:**
   - Bấm vào một dải màu đặt phòng để xem chi tiết (Drawer bên phải).
   - Bấm vào một ô trống trên lưới để tạo đặt phòng mới (Quick Create).
6. **Menu Quản lý:** Chuyển qua các tab "Phòng", "Loại phòng", "Khách hàng" để xem tính năng CRUD.

---

## 📊 Cách test tính năng Export (Excel/CSV)

Tính năng xuất dữ liệu báo cáo hoạt động ngay trên màn hình Timeline:
1. Vào trang **Timeline**.
2. Chọn khoảng thời gian muốn xem (Ví dụ: Tuần này).
3. Chọn bộ lọc trạng thái (Ví dụ: "Đang ở", "Sắp đến").
4. Nhấn nút **Xuất Excel** (hoặc Xuất CSV) ở góc trên bên phải.
5. Hệ thống sẽ áp dụng chính xác bộ lọc hiện tại để xuất file.
6. Mở file vừa tải về, kiểm tra các cột thông tin chuẩn vận hành: *Phòng, Tên khách, Ngày đến, Ngày đi, Loại giá...*

---

## 🔗 Cách test Webhook Outbound (n8n Integration)

Hệ thống có cấu hình webhook gửi event sang hệ thống khác (như n8n) mỗi khi có sự kiện (tạo/sửa booking, đổi phòng...).
Trong dữ liệu seed đã tạo sẵn một webhook có URL là `http://localhost:5678/webhook/hotel-events`.

**Để test nhanh webhook payload mà không cần sửa code:**
1. Đảm bảo Backend đang chạy.
2. Dùng Postman hoặc Terminal gửi request để test (nhớ kèm theo token đăng nhập):

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
3. Xem logs delivery của webhook để biết thành công hay thất bại (Hệ thống có cơ chế tự retry tối đa 3 lần với exponential backoff nếu bị lỗi):
```bash
curl -X GET http://localhost:3001/api/integrations/n8n/logs \
  -H "Authorization: Bearer $TOKEN"
```
4. Để test event thực, hãy thử lên màn hình Timeline, đổi trạng thái phòng (Check-in/Check-out), hệ thống sẽ tự trigger event (ví dụ `reservation.checked_in`) và ghi log lại.
