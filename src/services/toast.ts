import { toast as sonner } from "sonner";

// Fachada sobre o Sonner (shadcn). O <Toaster /> fica no Layout.
export const toast = {
  info: (message: string) => sonner(message),
  error: (message: string) => sonner.error(message),
  success: (message: string) => sonner.success(message),
};
