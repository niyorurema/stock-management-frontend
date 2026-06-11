import { useLanguage } from '../contexts/LanguageContext';
import toast from '../utils/toastPolyfill';

export const useTranslatedNotify = () => {
  const { t } = useLanguage();

  return {
    success: (messageKey, params = {}) => {
      let message = t(messageKey);
      Object.keys(params).forEach(key => {
        message = message.replace(`{${key}}`, params[key]);
      });
      toast.success(message);
    },
    error: (messageKey, params = {}) => {
      let message = t(messageKey);
      Object.keys(params).forEach(key => {
        message = message.replace(`{${key}}`, params[key]);
      });
      toast.error(message);
    },
    info: (messageKey) => toast.info(t(messageKey)),
    warning: (messageKey) => toast.warning(t(messageKey))
  };
};