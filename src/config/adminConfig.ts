/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QUẢN LÝ MẬT KHẨU VÀ PHIÊN ĐĂNG NHẬP QUẢN TRỊ VIÊN (ADMIN AUTH)
 */

export const SYSTEM_DEFAULT_ADMIN_PASSWORD = 
  (import.meta.env.VITE_ADMIN_PASSWORD as string)?.trim() || '123456';

const ADMIN_SESSION_STORAGE_KEY = 'labor_law_admin_auth_status_v1';
const ADMIN_CUSTOM_PASSWORD_KEY = 'labor_law_custom_admin_password_v1';

/**
 * Lấy mật khẩu Admin hiện tại (ưu tiên mật khẩu do người dùng đổi)
 */
export function getAdminPassword(): string {
  try {
    const custom = localStorage.getItem(ADMIN_CUSTOM_PASSWORD_KEY);
    if (custom && custom.trim().length > 0) {
      return custom.trim();
    }
  } catch (err) {
    console.warn('Không thể đọc mật khẩu tùy chỉnh từ localStorage:', err);
  }
  return SYSTEM_DEFAULT_ADMIN_PASSWORD;
}

/**
 * Lưu mật khẩu Admin mới
 */
export function saveCustomAdminPassword(newPassword: string): boolean {
  if (!newPassword || newPassword.trim().length === 0) return false;
  try {
    localStorage.setItem(ADMIN_CUSTOM_PASSWORD_KEY, newPassword.trim());
    return true;
  } catch (err) {
    console.error('Không thể lưu mật khẩu Admin mới vào localStorage:', err);
    return false;
  }
}

/**
 * Khôi phục mật khẩu Admin về mặc định ban đầu
 */
export function resetCustomAdminPassword(): void {
  try {
    localStorage.removeItem(ADMIN_CUSTOM_PASSWORD_KEY);
  } catch (err) {
    console.error('Không thể xóa mật khẩu tùy chỉnh trong localStorage:', err);
  }
}

/**
 * Kiểm tra xem có đang dùng mật khẩu tùy chỉnh hay không
 */
export function isCustomAdminPasswordSet(): boolean {
  try {
    const custom = localStorage.getItem(ADMIN_CUSTOM_PASSWORD_KEY);
    return Boolean(custom && custom.trim().length > 0);
  } catch {
    return false;
  }
}

/**
 * Kiểm tra mật khẩu Admin khi đăng nhập
 */
export function checkAdminPassword(input: string): boolean {
  if (!input) return false;
  const currentPassword = getAdminPassword();
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
