import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api/index';

interface ASRContextType {
    asrEnabled: boolean;
    refreshASRStatus: () => Promise<void>;
}

const ASRContext = createContext<ASRContextType | undefined>(undefined);

export const ASRProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [asrEnabled, setAsrEnabled] = useState(false);

    const refreshASRStatus = async () => {
        try {
            const res = await api.getASRProviders();
            if (res.code === 200 && res.data.active_provider) {
                setAsrEnabled(true);
            } else {
                setAsrEnabled(false);
            }
        } catch (e) {
            console.error("Failed to check ASR status", e);
            setAsrEnabled(false);
        }
    };

    useEffect(() => {
        refreshASRStatus();
    }, []);

    return (
        <ASRContext.Provider value={{ asrEnabled, refreshASRStatus }}>
            {children}
        </ASRContext.Provider>
    );
};

export const useASR = () => {
    const context = useContext(ASRContext);
    if (context === undefined) {
        throw new Error('useASR must be used within an ASRProvider');
    }
    return context;
};
