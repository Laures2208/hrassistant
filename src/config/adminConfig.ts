/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QUẢN LÝ MẬT KHẨU VÀ PHIÊN ĐĂNG NHẬP QUẢN TRỊ VIÊN (ADMIN AUTH)
 */

export const DEFAULT_ADMIN_PASSWORD = 
  (import.meta.env.VITE_ADMIN_PASSWORD as string)?.trim() || '123456';

const ADMIN_SESSION_STORAGE_KEY = 'labor_law_admin_auth_status_v1';

/**
 * Kiểm tra mật khẩu Admin
 */
export function checkAdminPassword(input: string): boolean {
  if (!input) return false;
  const currentPassword = DEFAULT_ADMIN_PASSWORD;
  return input.trim() === currentPassword;
}

/**
 * Lấy trạng thái đăng nhập Admin từ sessionStorage
 */
export function getAdminSession(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Lưu hoặc xóa trạng thái đăng nhập Admin trong phiên làm việc
 */
export function setAdminSession(isLoggedIn: boolean): void {
  try {
    if (isLoggedIn) {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Không thể lưu trạng thái Admin vào SessionStorage:', err);
  }
}
