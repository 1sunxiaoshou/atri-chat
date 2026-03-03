import React from 'react';
import { Activity } from 'lucide-react';
import { Character, Motion } from '../../../../types';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { MotionBindingsManager } from '../../motion/MotionBindingsManager';

interface LocalMotionBinding {
    motion_id: string;
    category: 'initial' | 'idle' | 'thinking' | 'reply';
}

interface MotionTabProps {
    character: Character;
    motions: Motion[];
    localMotionBindings: LocalMotionBinding[];
    onLocalBindingsChange: (bindings: LocalMotionBinding[]) => void;
}

export const MotionTab: React.FC<MotionTabProps> = ({
    character,
    motions,
    localMotionBindings,
    onLocalBindingsChange
}) => {
    const { t } = useLanguage();
    return (
        <div className="animate-in slide-in-from-right-4 duration-300 h-full">
            {motions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Activity size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">
                        {t('character.noMotionsAvailable')}
                    </p>
                </div>
            ) : (
                <MotionBindingsManager
                    characterId={character.id}
                    motions={motions}
                    localBindings={localMotionBindings}
                    onLocalBindingsChange={onLocalBindingsChange}
                />
            )}
        </div>
    );
};
