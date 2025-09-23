
import React from 'react';
import { StrainContribution, StrainPreference } from '../../types';
import { LeafIcon, SunIcon, SparklesIcon } from '../icons';

interface StrainPillProps {
  strain: StrainContribution;
}

const StrainIcon: React.FC<{type: StrainPreference}> = ({ type }) => {
    const iconProps = { className: "w-5 h-5" };
    switch (type) {
        case StrainPreference.Indica:
            return <LeafIcon {...iconProps} />;
        case StrainPreference.Sativa:
            return <SunIcon {...iconProps} />;
        case StrainPreference.Hybrid:
            return <SparklesIcon {...iconProps} />;
        default:
            return <SparklesIcon {...iconProps} />;
    }
}

const StrainPill: React.FC<StrainPillProps> = ({ strain }) => {
  const typeColors: Record<string, string> = {
    [StrainPreference.Indica]: 'text-purple-400 border-purple-400/50 bg-purple-400/10',
    [StrainPreference.Sativa]: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10',
    [StrainPreference.Hybrid]: 'text-green-400 border-green-400/50 bg-green-400/10',
    [StrainPreference.Any]: 'text-brand-secondary border-brand-secondary/50 bg-brand-secondary/10',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${typeColors[strain.type] || typeColors[StrainPreference.Any]}`}>
      <StrainIcon type={strain.type} />
      <span className="font-semibold">{strain.strainName}</span>
    </div>
  );
};

export default StrainPill;
