import React from 'react';
import {
  AlertTriangle, Trash2, CheckCircle2, Info, X,
  Save, AlertCircle
} from 'lucide-react';
import './ConfirmModal.css';

/**
 * Modern Confirmation & Alert Modal Component
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onConfirm: () => void
 * - title: string
 * - message: string
 * - type: 'danger' | 'warning' | 'info' | 'success'
 * - confirmText: string
 * - cancelText: string
 * - loading: boolean
 * - icon: LucideIcon (optional)
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi Aksi',
  message = 'Apakah Anda yakin ingin melanjutkan?',
  type = 'danger',
  confirmText = 'Lanjutkan',
  cancelText = 'Batal',
  loading = false,
  icon: CustomIcon,
}) {
  if (!isOpen) return null;

  const getIcon = () => {
    if (CustomIcon) return <CustomIcon size={28} />;
    switch (type) {
      case 'danger':
        return <Trash2 size={28} />;
      case 'warning':
        return <AlertTriangle size={28} />;
      case 'success':
        return <CheckCircle2 size={28} />;
      case 'save':
        return <Save size={28} />;
      default:
        return <Info size={28} />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'btn-confirm-danger';
      case 'warning':
        return 'btn-confirm-warning';
      case 'success':
      case 'save':
        return 'btn-confirm-success';
      default:
        return 'btn-confirm-primary';
    }
  };

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div
        className={`confirm-modal-dialog ${type}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="confirm-modal-close-btn" onClick={onClose} disabled={loading}>
          <X size={18} />
        </button>

        <div className="confirm-modal-content">
          <div className={`confirm-icon-bubble ${type}`}>
            {getIcon()}
          </div>

          <div className="confirm-text-wrap">
            <h3 className="confirm-modal-title">{title}</h3>
            <p className="confirm-modal-message">{message}</p>
          </div>
        </div>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn-confirm-cancel"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn-confirm-action ${getConfirmButtonClass()}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="confirm-btn-loading">
                <span className="confirm-mini-spinner" /> Memproses...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
