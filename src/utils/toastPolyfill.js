import { toast as hotToast } from 'react-hot-toast';

// Extend hotToast with aliases if missing
if (typeof hotToast.info !== 'function') {
  hotToast.info = (message, opts = {}) => hotToast(message, { icon: 'ℹ️', ...opts });
}
if (typeof hotToast.warning !== 'function') {
  hotToast.warning = (message, opts = {}) => hotToast(message, { icon: '⚠️', ...opts });
}

export default hotToast;
