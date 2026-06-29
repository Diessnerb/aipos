const SIDEBAR_COOKIE_NAME = "sidebar:state";

export function getSidebarStateFromCookie(): boolean | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  const sidebarCookie = cookies.find(cookie => 
    cookie.trim().startsWith(`${SIDEBAR_COOKIE_NAME}=`)
  );
  
  if (!sidebarCookie) return null;
  
  const value = sidebarCookie.split('=')[1];
  return value === 'true';
}