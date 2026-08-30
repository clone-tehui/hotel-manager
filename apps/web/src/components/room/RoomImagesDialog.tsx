'use client';

import { useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography,
  Box, IconButton, CircularProgress, Paper,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useDeleteRoomImage, useReorderRoomImages, useRoomImages, useUploadRoomImages } from '@/hooks/api';
import { useToast } from '@/providers/ToastProvider';

interface Props {
  roomId: string | null;
  roomLabel?: string;
  open: boolean;
  onClose: () => void;
}

export function RoomImagesDialog({ roomId, roomLabel, open, onClose }: Props) {
  const { toast } = useToast();
  const { data, isLoading } = useRoomImages(roomId ?? '');
  const uploadMut = useUploadRoomImages(roomId ?? '');
  const reorderMut = useReorderRoomImages(roomId ?? '');
  const deleteMut = useDeleteRoomImage(roomId ?? '');

  const images: any[] = useMemo(() => data?.data ?? [], [data]);

  const handleUpload = async (files?: FileList | null) => {
    if (!roomId || !files?.length) return;
    try {
      await uploadMut.mutateAsync(Array.from(files));
      toast('Đã upload ảnh cho căn hộ', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Upload ảnh thất bại', 'error');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!roomId) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const nextIds = images.map((item) => item.id);
    [nextIds[index], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[index]];
    try {
      await reorderMut.mutateAsync(nextIds);
    } catch (e: any) {
      toast(e?.message ?? 'Không đổi được thứ tự ảnh', 'error');
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!roomId) return;
    try {
      await deleteMut.mutateAsync(imageId);
      toast('Đã xoá ảnh', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Không xoá được ảnh', 'error');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={700}>Ảnh căn {roomLabel ?? ''}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="body2" fontWeight={700}>Upload hàng loạt</Typography>
              <Typography variant="caption" color="text.secondary">Có thể chọn nhiều ảnh một lần, mỗi ảnh tối đa 40MB. Hệ thống sẽ tự chia lượt upload, nén và lưu theo thứ tự.</Typography>
            </Box>
            <Button component="label" variant="contained" startIcon={uploadMut.isPending ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />} disabled={!roomId || uploadMut.isPending}>
              Tải ảnh lên
              <input hidden multiple type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files)} />
            </Button>
          </Stack>

          {isLoading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : images.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">Chưa có ảnh nào cho căn này.</Typography>
            </Paper>
          ) : (
            <Stack spacing={1.25}>
              {images.map((image, index) => (
                <Paper key={image.id} variant="outlined" sx={{ p: 1.25 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Box
                      component="img"
                      src={image.thumbUrl || image.url}
                      alt={`room-image-${index + 1}`}
                      sx={{ width: { xs: '100%', sm: 120 }, height: { xs: 180, sm: 90 }, objectFit: 'cover', borderRadius: 1.5, bgcolor: 'action.hover' }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700}>Ảnh #{index + 1}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{image.url}</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton size="small" onClick={() => handleMove(index, -1)} disabled={index === 0 || reorderMut.isPending}><ArrowUpwardIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => handleMove(index, 1)} disabled={index === images.length - 1 || reorderMut.isPending}><ArrowDownwardIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(image.id)} disabled={deleteMut.isPending}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
