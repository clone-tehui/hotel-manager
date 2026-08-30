// ─── Shared TypeScript types across apps/api and apps/web ─────────────────────

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface RoomType {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  maxGuests: number;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  roomType: RoomType;
}

export interface Guest {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  nationality?: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  guest: Guest;
  room: Room;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  status: BookingStatus;
  totalAmount: number;
  notes?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface ApiError {
  statusCode: number;
  message: string;
}
