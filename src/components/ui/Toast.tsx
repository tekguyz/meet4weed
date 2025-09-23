
import React, { useContext } from 'react';
import { AppContext, ToastType } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '../icons';

const ToastContainer: React.FC = () => {
  const { toasts } = useContext(AppContext);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 w-full max-w-xs">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </div>
  );
};

interface ToastProps {
  message: string;
  type: ToastType;
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  const typeStyles = {
    [ToastType.Success]: {
      icon: <CheckCircleIcon className="w-6 h-6 text-green-400" />,
      barColor: 'bg-green-400',
    },
    [ToastType.Error]: {
      icon: <XCircleIcon className="w-6 h-6 text-red-400" />,
      barColor: 'bg-red-400',
    },
    [ToastType.Warning]: {
      icon: <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400" />,
      barColor: 'bg-yellow-400',
    },
  };

  const { icon, barColor } = typeStyles[type];

  return (
    <div className="bg-dark-surface border-2 border-brand-primary/20 shadow-lg rounded-lg flex items-center p-4 overflow-hidden animate-slide-in">
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", barColor)}></div>
        <div className="pl-2 pr-4">{icon}</div>
        <p className="text-sm font-medium text-dark-text">{message}</p>
        <style>{`
            @keyframes slide-in {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            .animate-slide-in {
                animation: slide-in 0.5s forwards;
            }
        `}</style>
    </div>
  );
};

export default ToastContainer;