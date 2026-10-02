import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kiểm tra căn hộ còn trống | ChiHome',
  description: 'Chọn ngày nhận và trả phòng để xem căn hộ còn trống tại ChiHome. Không cần đăng nhập.',
};

export default function PublicAvailabilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
