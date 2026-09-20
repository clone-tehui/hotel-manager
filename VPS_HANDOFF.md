# Handoff vận hành — ChiLuxe Hotel Manager

Tài liệu này dành cho agent/kỹ sư tiếp quản hệ thống. Không ghi mật khẩu, JWT secret, khoá API hoặc thông tin đăng nhập vào tài liệu hay git.

## Mục tiêu và vị trí triển khai

- Ứng dụng quản lý căn hộ/khách sạn: Hotel Manager (Next.js + NestJS + PostgreSQL).
- Mã nguồn làm việc local: `/Users/mac/Documents/Codex/2026-09-08/leen/hotel-manager`.
- Máy chủ production: VPS có IP `103.97.126.245`; project ở `/opt/chihome-hotel-manager`.
- Docker Compose project: `chihome_hotel`.
- URL chính: `https://www.chiluxe.vn`.
- URL IP tạm thời/kiểm tra: `http://103.97.126.245:3000`.

## Kiến trúc production

Docker Compose chạy các service sau:

| Service | Vai trò | Port public |
| --- | --- | --- |
| `web` | Next.js frontend | 3000 (chỉ dùng kiểm tra trực tiếp) |
| `api` | NestJS API | 3001 (chỉ dùng kiểm tra trực tiếp) |
| `db` | PostgreSQL 16 | nội bộ Docker |
| `migrate` | Prisma migration/generate khi deploy | nội bộ |
| `caddy` | Reverse proxy + HTTPS tự động | 80, 443 |

`Caddyfile` chuyển `chiluxe.vn` sang `https://www.chiluxe.vn{uri}`, proxy `/api/*` và `/uploads/*` về API, các route khác về frontend. Không đưa API URL có `localhost` vào bản build production.

## Biến môi trường

File runtime trên VPS: `/opt/chihome-hotel-manager/.env`. File này là bí mật, không sao chép vào git hoặc phản hồi chat.

Các giá trị cần nhất quán:

- `DATABASE_URL`: kết nối PostgreSQL production.
- `FRONTEND_URL=https://www.chiluxe.vn`.
- `LEGACY_FRONTEND_URL=http://103.97.126.245:3000` để đăng nhập qua IP vẫn qua CORS.
- `NEXT_PUBLIC_API_URL=https://www.chiluxe.vn` cho frontend production.
- `JWT_SECRET` và các khoá bridge/webhook phải giữ nguyên khi deploy, nếu thay đổi mọi phiên đăng nhập cũ sẽ hết hạn.

Trong `apps/web/src/lib/api.ts`, frontend có fallback API là `:3001` khi người dùng mở bằng IPv4; do đó IP VPS và domain đều hỗ trợ đăng nhập.

## Dữ liệu đã đồng bộ

Ngày 2026-09-19, database local đã được dump toàn bộ và restore vào VPS. Số lượng đối soát sau restore:

- 5 toà nhà
- 6 loại phòng
- 108 phòng/căn
- 5.596 khách hàng
- 8.690 booking
- 2 tài khoản người dùng

Khi cần đồng bộ lại từ local sang production, phải xác nhận local là nguồn dữ liệu chuẩn vì restore toàn database sẽ ghi đè các thay đổi đã tạo trực tiếp trên VPS. Dùng custom dump `pg_dump --format=custom`, chuyển file an toàn, rồi `pg_restore --clean --if-exists --no-owner` vào database production; sau đó khởi động lại `api` và `web`.

## Chức năng đã triển khai gần đây

- Booking importer: lọc booking trùng và bỏ qua căn đang bảo trì.
- Timeline hiển thị thêm 5 ngày quá khứ, màu trạng thái theo quy ước: Đã đặt xanh dương, Chưa đến tím, Nhận phòng đỏ cam, Đang ở/chưa đi cam, Trả phòng hồng, Đã hủy xám.
- Timeline không hiển thị giới tính/mã `CHIH-xxxx` trong viên booking.
- Dashboard loại trừ căn bảo trì, bổ sung báo cáo doanh thu/lợi nhuận/hoàn vốn, khách quen, tỷ lệ lấp đầy và các khoảng thời gian được yêu cầu.
- Giá vốn tháng, giá bán đêm được lưu ở phòng/căn theo dữ liệu Excel đã nhận.
- Doanh thu Dashboard được ghi nhận theo đêm lưu trú: `totalAmount / totalNights` cho từng đêm thuộc kỳ báo cáo, không dồn cả booking vào ngày Check-in. Quy tắc này áp dụng cho ngày/tuần/tháng/năm, xu hướng tháng và báo cáo theo căn.
- Nền tảng booking được hỗ trợ: `airbnb`, `trip`, `agoda`, `booking`, `zalo`, `sale`, `khac`. API chỉ chấp nhận các mã này.
- Cả `USER` và `ADMIN` được phép hủy booking, Check-in, Check-out. Check-in ghi `actualCheckIn`, Check-out ghi `actualCheckOut`; Timeline đổi màu theo trạng thái thực tế. Check-out chỉ khả dụng sau Check-in để bảo vệ luồng vận hành.

## Quy trình deploy thay đổi mã nguồn

1. Kiểm tra thay đổi: `git diff --check` và build API/Web nếu có thể.
2. Commit thay đổi tại local. Các commit gần đây gồm `4420139 feat: add Trip Agoda and Booking platforms` và các commit deploy/domain/database trước đó trong lịch sử git.
3. Chuyển các file nguồn đã thay đổi lên đúng đường dẫn tương ứng dưới `/opt/chihome-hotel-manager` (không ghi đè `.env`, database volumes, uploads hoặc Caddy data).
4. Trên VPS chạy:

   ```bash
   cd /opt/chihome-hotel-manager
   docker compose up -d --build api web
   docker compose ps
   ```

5. Xác nhận `api` và `web` là `healthy`; kiểm tra `/api/health` qua domain hoặc dùng `curl --resolve www.chiluxe.vn:443:103.97.126.245 https://www.chiluxe.vn/api/health` nếu DNS cục bộ chưa cập nhật.

Không dùng `rsync --delete` vào thư mục production trừ khi đã loại trừ rõ `.env`, database dumps, uploads, Caddy state và artefact cần giữ.

## DNS và HTTPS

- Domain cần bản ghi A cho cả `@` và `www` trỏ tới `103.97.126.245`.
- Đã từng có tình trạng DNS resolver local không tìm được `chiluxe.vn` trong khi server vẫn hoạt động; kiểm tra nameserver/bản ghi A trước khi kết luận lỗi ứng dụng.
- Caddy tự xin/gia hạn chứng chỉ. Port 80 và 443 phải được mở ở firewall/VPS để HTTPS hoạt động.

## Kiểm tra và xử lý sự cố nhanh

- Login bị `Network Error`: kiểm tra `api` healthy, CORS (`FRONTEND_URL`, `LEGACY_FRONTEND_URL`) và base API của frontend.
- Login báo sai mật khẩu nhưng local đúng: so sánh bảng `users` giữa local/VPS; full database dump cần bao gồm bảng này.
- Domain không mở: kiểm tra A records, Caddy logs, firewall 80/443 và certificate.
- Domain mở nhưng data trống: kiểm tra `DATABASE_URL` đang trỏ DB `chihome_hotel-db-1`, sau đó đối soát counts trong các bảng `buildings`, `room_types`, `rooms`, `guests`, `reservations`, `users`.
- Timeline chưa đổi màu sau thao tác: hard refresh, xác nhận mutation trả thành công và kiểm tra `actualCheckIn`/`actualCheckOut`, `status` của reservation.

## Ranh giới an toàn

- Không xuất thông tin đăng nhập VPS, mật khẩu DB, JWT, API key, credential OTA hoặc dữ liệu khách hàng ra bên ngoài.
- Trước mọi restore database/destructive deploy, xác nhận nguồn dữ liệu chuẩn và sao lưu database VPS.
- Không tự ý xóa container volume PostgreSQL, Caddy certificates hoặc thư mục uploads.
