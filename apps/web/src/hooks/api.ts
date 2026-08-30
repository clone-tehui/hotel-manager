import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Shared invalidation helpers ─────────────────────────────────────────────
const invalidateRoomQueries = (qc: any) => {
  qc.invalidateQueries({ queryKey: ['rooms'] });
  qc.invalidateQueries({ queryKey: ['rooms-timeline'] });
};

const invalidateReservationQueries = (qc: any, id?: string) => {
  qc.invalidateQueries({ queryKey: ['reservations'] });
  qc.invalidateQueries({ queryKey: ['timeline'] });
  if (id) {
    qc.invalidateQueries({ queryKey: ['reservations', id] });
    qc.invalidateQueries({ queryKey: ['reservation-logs', id] });
  }
  invalidateRoomQueries(qc);
  qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
};

// ─── Buildings ────────────────────────────────────────────────────────────────
export const useBuildings = () =>
  useQuery({
    queryKey: ['buildings'],
    queryFn: () => api.get('/buildings'),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

export const useBuilding = (id: string) =>
  useQuery({ queryKey: ['buildings', id], queryFn: () => api.get(`/buildings/${id}`), enabled: !!id });

export const useCreateBuilding = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: any) => api.post('/buildings', d), onSuccess: () => qc.invalidateQueries({ queryKey: ['buildings'] }) });
};

export const useUpdateBuilding = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/buildings/${id}`, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['buildings'] }) });
};

export const useDeleteBuilding = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/buildings/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['buildings'] }) });
};

// ─── Rooms ────────────────────────────────────────────────────────────────────
export const useRooms = (params?: any) =>
  useQuery({ queryKey: ['rooms', params], queryFn: () => api.get('/rooms', params).then((r: any) => r) });

export const useRoom = (id: string) =>
  useQuery({ queryKey: ['rooms', id], queryFn: () => api.get(`/rooms/${id}`), enabled: !!id });

export const useCreateRoom = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: any) => api.post('/rooms', d), onSuccess: () => invalidateRoomQueries(qc) });
};

export const useUpdateRoom = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/rooms/${id}`, d), onSuccess: () => invalidateRoomQueries(qc) });
};

export const useDeleteRoom = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/rooms/${id}`), onSuccess: () => invalidateRoomQueries(qc) });
};

export const useRoomImages = (roomId: string) =>
  useQuery({
    queryKey: ['room-images', roomId],
    queryFn: () => api.get(`/rooms/${roomId}/images`),
    enabled: !!roomId,
  });

export const useUploadRoomImages = (roomId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const maxBatchFiles = 20;
      const maxBatchBytes = 18 * 1024 * 1024;
      const batches: File[][] = [];
      let currentBatch: File[] = [];
      let currentBytes = 0;

      for (const file of files) {
        if (currentBatch.length && (currentBatch.length >= maxBatchFiles || currentBytes + file.size > maxBatchBytes)) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBytes = 0;
        }
        currentBatch.push(file);
        currentBytes += file.size;
      }
      if (currentBatch.length) batches.push(currentBatch);

      const results = [];
      for (const batch of batches) {
        const formData = new FormData();
        batch.forEach((file) => formData.append('files', file));
        results.push(await api.postForm(`/rooms/${roomId}/images/upload`, formData));
      }
      return results.at(-1);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room-images', roomId] });
      qc.invalidateQueries({ queryKey: ['rooms', roomId] });
      qc.invalidateQueries({ queryKey: ['quick-room-search'] });
    },
  });
};

export const useReorderRoomImages = (roomId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageIds: string[]) => api.patch(`/rooms/${roomId}/images/reorder`, { imageIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room-images', roomId] });
      qc.invalidateQueries({ queryKey: ['quick-room-search'] });
    },
  });
};

export const useDeleteRoomImage = (roomId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => api.del(`/rooms/${roomId}/images/${imageId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room-images', roomId] });
      qc.invalidateQueries({ queryKey: ['quick-room-search'] });
    },
  });
};

// ─── Room Types ───────────────────────────────────────────────────────────────
export const useRoomTypes = () =>
  useQuery({
    queryKey: ['room-types'],
    queryFn: () => api.get('/room-types'),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

export const useCreateRoomType = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: any) => api.post('/room-types', d), onSuccess: () => qc.invalidateQueries({ queryKey: ['room-types'] }) });
};

export const useUpdateRoomType = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/room-types/${id}`, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['room-types'] }) });
};

// ─── Guests ───────────────────────────────────────────────────────────────────
export const useGuests = (params?: any) =>
  useQuery({ queryKey: ['guests', params], queryFn: () => api.get('/guests', params) });

export const useGuest = (id: string) =>
  useQuery({ queryKey: ['guests', id], queryFn: () => api.get(`/guests/${id}`), enabled: !!id });

export const useCreateGuest = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: any) => api.post('/guests', d), onSuccess: () => qc.invalidateQueries({ queryKey: ['guests'] }) });
};

export const useUpdateGuest = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/guests/${id}`, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['guests'] }) });
};

export const useDeleteGuest = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/guests/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['guests'] }) });
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const useUsers = (params?: any) =>
  useQuery({ queryKey: ['users', params], queryFn: () => api.get('/users', params) });

export const useUser = (id: string) =>
  useQuery({ queryKey: ['users', id], queryFn: () => api.get(`/users/${id}`), enabled: !!id });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: any) => api.post('/users', d), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/users/${id}`, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
};

export const useSetUserPassword = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, password }: { id: string; password: string }) => api.post(`/users/${id}/set-password`, { password }), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
};

export const useLockUser = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post(`/users/${id}/lock`), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
};

export const useUnlockUser = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post(`/users/${id}/unlock`), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
};

// ─── API Keys ─────────────────────────────────────────────────────────────────
export const useApiKeys = () =>
  useQuery({ queryKey: ['api-keys'], queryFn: () => api.get('/api-keys') });

export const useCreateApiKey = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: { name: string; scopes?: string[] }) => api.post('/api-keys', d), onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }) });
};

export const useRevokeApiKey = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/api-keys/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }) });
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const useDashboardSummary = () =>
  useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary'),
    staleTime: 30_000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

export const useDashboardReport = (params?: any, enabled = true) =>
  useQuery({
    queryKey: ['dashboard-report', params],
    queryFn: () => api.get('/dashboard/report', params),
    enabled: enabled && !!params?.from && !!params?.to,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

// ─── Reservations ─────────────────────────────────────────────────────────────
export const useReservations = (params?: any) =>
  useQuery({ queryKey: ['reservations', params], queryFn: () => api.get('/reservations', params) });

export const useReservation = (id: string) =>
  useQuery({ queryKey: ['reservations', id], queryFn: () => api.get(`/reservations/${id}`), enabled: !!id });

export const useQuickRoomSearch = (params?: any, enabled = true) =>
  useQuery({
    queryKey: ['quick-room-search', params],
    queryFn: () => api.get('/reservations/quick-room-search', params),
    enabled: enabled && !!params,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

export const useReservationLogs = (id: string) =>
  useQuery({ queryKey: ['reservation-logs', id], queryFn: () => api.get(`/reservations/${id}/logs`), enabled: !!id });

export const useCreateReservation = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: any) => api.post('/reservations', d), onSuccess: () => invalidateReservationQueries(qc) });
};

export const useUpdateReservation = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/reservations/${id}`, d), onSuccess: (_, v) => invalidateReservationQueries(qc, v.id) });
};

// ─── Reservation Actions ──────────────────────────────────────────────────────
const invalidateRes = (qc: any, id?: string) => {
  invalidateReservationQueries(qc, id);
};

export const useCancelReservation = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.post(`/reservations/${id}/cancel`, d), onSuccess: (_, v) => invalidateRes(qc, v.id) });
};

export const useCheckIn = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.post(`/reservations/${id}/check-in`, d), onSuccess: (_, v) => invalidateRes(qc, v.id) });
};

export const useCheckOut = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.post(`/reservations/${id}/check-out`, d), onSuccess: (_, v) => invalidateRes(qc, v.id) });
};

export const useExtendReservation = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.post(`/reservations/${id}/extend`, d), onSuccess: (_, v) => invalidateRes(qc, v.id) });
};

export const useAssignRoom = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.post(`/reservations/${id}/assign-room`, d), onSuccess: (_, v) => invalidateRes(qc, v.id) });
};

export const useChangeRoom = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.post(`/reservations/${id}/change-room`, d), onSuccess: (_, v) => invalidateRes(qc, v.id) });
};

// ─── System Settings ──────────────────────────────────────────────────────────
export const useSystemSettings = () =>
  useQuery({
    queryKey: ['system-settings'],
    queryFn: () => api.get('/system/settings'),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

export const useUpdateSystemSettings = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: Record<string, string>) => api.patch('/system/settings', d), onSuccess: () => qc.invalidateQueries({ queryKey: ['system-settings'] }) });
};

export const useUploadSystemImage = () =>
  useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.postForm('/system/settings/upload-image', formData);
    },
  });

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export const useWebhooks = () =>
  useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/webhooks'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useCreateWebhook = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: any) => api.post('/webhooks', d), onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }) });
};

export const useUpdateWebhook = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/webhooks/${id}`, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }) });
};

export const useDeleteWebhook = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/webhooks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }) });
};

export const useTestWebhook = () =>
  useMutation({ mutationFn: (id: string) => api.post(`/webhooks/${id}/test`) });
