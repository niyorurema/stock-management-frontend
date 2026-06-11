import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { getSwalTheme } from '../utils/swalTheme';

function themedSwalOptions(extra = {}) {
  const theme = localStorage.getItem('theme') || 'light';
  return { ...getSwalTheme(theme), ...extra };
}

export const notify = {
  success: (message) => toast.success(message, {
    duration: 3000,
    position: 'top-right',
    style: { background: '#10b981', color: 'white' },
    iconTheme: { primary: 'white', secondary: '#10b981' }
  }),

  error: (message) => toast.error(message, {
    duration: 4000,
    position: 'top-right',
    style: { background: '#ef4444', color: 'white' }
  }),

  warning: (message) => toast.custom((t) => (
    <div className={`toast-warning ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
      ⚠️ {message}
    </div>
  )),

  info: (message) => toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️'
  })
};

export const confirm = {
  delete: async (itemName = 'cet élément') => {
    const result = await Swal.fire({
      ...themedSwalOptions(),
      title: 'Êtes-vous sûr ?',
      text: `Vous allez supprimer ${itemName}. Cette action est irréversible !`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      reverseButtons: true
    });
    return result.isConfirmed;
  },

  save: async (itemName = 'cet élément') => {
    const result = await Swal.fire({
      ...themedSwalOptions(),
      title: 'Enregistrement',
      text: `Voulez-vous vraiment enregistrer ${itemName} ?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Oui, enregistrer',
      cancelButtonText: 'Annuler'
    });
    return result.isConfirmed;
  },

  success: (message) => {
    Swal.fire({
      ...themedSwalOptions({ confirmButtonColor: '#10b981' }),
      title: 'Succès !',
      text: message,
      icon: 'success',
      timer: 2000,
      timerProgressBar: true
    });
  },

  error: (message) => {
    Swal.fire({
      ...themedSwalOptions({ confirmButtonColor: '#dc2626' }),
      title: 'Erreur !',
      text: message,
      icon: 'error',
    });
  },

  info: (title, message) => {
    Swal.fire({
      ...themedSwalOptions(),
      title: title,
      text: message,
      icon: 'info',
    });
  }
};
