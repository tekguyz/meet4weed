
import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-dark-surface border-2 border-brand-primary/20 rounded-lg p-4">
      <div className="animate-pulse">
        <div className="h-5 bg-brand-primary/20 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-brand-secondary/20 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-dark-text/20 rounded w-full mb-1"></div>
        <div className="h-4 bg-dark-text/20 rounded w-5/6 mb-4"></div>
        <div className="border-t border-brand-primary/10 pt-3 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full bg-brand-secondary/20 mr-2"></div>
            <div className="h-4 bg-dark-text/20 rounded w-24"></div>
          </div>
          <div className="flex flex-col items-end">
            <div className="h-3 bg-dark-text/20 rounded w-16 mb-1"></div>
            <div className="h-3 bg-dark-text/20 rounded w-12"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonCard;
