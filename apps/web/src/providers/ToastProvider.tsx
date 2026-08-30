'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface ToastCtx { toast: (msg: string, s?: AlertColor) => void }
const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('success');

  const toast = useCallback((m: string, s: AlertColor = 'success') => {
    setMsg(m); setSeverity(s); setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert variant="filled" severity={severity} onClose={() => setOpen(false)} sx={{ minWidth: 300, boxShadow: 3 }}>
          {msg}
        </Alert>
      </Snackbar>

    </Ctx.Provider>
  );
}
