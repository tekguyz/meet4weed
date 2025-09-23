
import React from 'react';
import { MadeByTekguyz } from './MadeByTekguyzBadge';

const Footer: React.FC = () => {
  return (
    <>
      <footer className="w-full mt-12 py-6 border-t-2 border-brand-primary/20">
        <div className="container mx-auto text-center text-xs text-dark-text/50 flex flex-col items-center gap-4">
          <div>
            <p>&copy; {new Date().getFullYear()} Meet4Weed. All rights reserved.</p>
            <p className="mt-1">For medical use only by qualified patients in accordance with state law.</p>
          </div>
        </div>
      </footer>
      <MadeByTekguyz theme="dark" />
    </>
  );
};

export default Footer;