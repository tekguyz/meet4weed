
import React from 'react';
import { XIcon } from '../icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`bg-dark-surface border-2 border-brand-primary/50 rounded-lg shadow-glow-primary w-full max-w-md m-4 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-brand-primary/20">
          <h2 id="modal-title" className="text-xl font-bold text-brand-primary tracking-widest">{title}</h2>
          <button onClick={onClose} className="text-brand-primary/70 hover:text-brand-primary" aria-label="Close modal">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes fade-in-scale {
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-fade-in-scale {
          animation: fade-in-scale 0.3s forwards;
        }
      `}</style>
    </div>
  );
};

export default Modal;