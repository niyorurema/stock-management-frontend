/** Configuration SweetAlert2 alignée sur le thème clair/sombre */
export function getSwalTheme(theme = 'light') {
  const isDark = theme === 'dark';
  return {
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b',
    confirmButtonColor: '#667eea',
    cancelButtonColor: isDark ? '#475569' : '#64748b',
  };
}

export function swalFire(options = {}, theme) {
  const stored = theme || localStorage.getItem('theme') || 'light';
  const themed = getSwalTheme(stored);
  return import('sweetalert2').then(({ default: Swal }) =>
    Swal.fire({
      ...themed,
      ...options,
      background: options.background ?? themed.background,
      color: options.color ?? themed.color,
    })
  );
}
