import { toast } from "sonner";

export const AUTH_SUBMIT_TOAST_ID = "auth-submit";

export function showAuthLoading(message: string): void {
  toast.loading(message, { id: AUTH_SUBMIT_TOAST_ID });
}

export function showAuthSuccess(message: string): void {
  toast.success(message, { id: AUTH_SUBMIT_TOAST_ID });
}

export function showAuthError(message: string): void {
  toast.error(message, { id: AUTH_SUBMIT_TOAST_ID });
}

export function dismissAuthToast(): void {
  toast.dismiss(AUTH_SUBMIT_TOAST_ID);
}
