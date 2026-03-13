import React from 'react';
import { Volume2, Database, Moon, Sun, Monitor, Palette } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAudioStore } from '../../store/useAudioStore';
import { Select, Card, CardContent } from '../ui';
import { cn } from '../../utils/cn';

const GeneralSettings: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, themeColor, setThemeColor } = useTheme();
  
  // 从 Zustand Store 读写所有设置，实现全全局实时同步
  const volume = useAudioStore((state) => state.volume);
  const setVolume = useAudioStore((state) => state.setVolume);
  const audioCacheLimit = useAudioStore((state) => state.audioCacheLimit);
  const setAudioCacheLimit = useAudioStore((state) => state.setAudioCacheLimit);

  const handleVolumeChange = (v: number) => {
    setVolume(v);
  };

  const handleCacheLimitChange = (limit: number) => {
    setAudioCacheLimit(limit);
  };

  return (
    <div className="space-y-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 头部标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">
          {t('settings.generalSettings')}
        </h2>
        <p className="text-muted-foreground mt-1">
          {t('settings.managePreferences')}
        </p>
      </div>

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

        {/* Appearance & Language */}
        <Card className="border-none bg-muted/30 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <Monitor size={20} className="text-foreground shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground mb-1">
                  {t('settings.interfaceSettings')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('settings.customizeAppearance')}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {t('settings.themeMode')}
                  </label>
                  <div className="flex p-1 bg-muted/60 rounded-xl ring-1 ring-border/50 max-w-md">
                    {[
                      { id: 'light', icon: Sun, label: t('settings.light') },
                      { id: 'dark', icon: Moon, label: t('settings.dark') },
                      { id: 'system', icon: Monitor, label: t('settings.system') }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setTheme(item.id as any)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs transition-all outline-none",
                          theme === item.id
                            ? "bg-background text-primary font-bold shadow-sm ring-1 ring-border/20"
                            : "text-muted-foreground hover:text-foreground font-medium"
                        )}
                      >
                        <item.icon size={16} className={cn(theme === item.id ? "text-primary" : "opacity-70")} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {t('settings.language')}
                  </label>
                  <Select
                    value={language}
                    onChange={(val) => setLanguage(val as any)}
                    options={[
                      { label: 'English', value: 'en' },
                      { label: '简体中文', value: 'zh' }
                    ]}
                    className="w-full max-w-md"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Palette size={16} />
                  {t('settings.themeMode')}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    {
                      id: 'indigo',
                      name: language === 'zh' ? '靛蓝烟波' : 'Indigo Slate',
                      desc: language === 'zh' ? '专业深邃' : 'Professional',
                      colors: ['#6366f1', '#4f46e5', '#4338ca']
                    },
                    {
                      id: 'emerald',
                      name: language === 'zh' ? '宝石翡翠' : 'Emerald',
                      desc: language === 'zh' ? '沉静优雅' : 'Elegant',
                      colors: ['#10b981', '#059669', '#047857']
                    },
                    {
                      id: 'violet',
                      name: language === 'zh' ? '紫罗兰' : 'Violet',
                      desc: language === 'zh' ? '时尚创意' : 'Creative',
                      colors: ['#8b5cf6', '#7c3aed', '#6d28d9']
                    },
                    {
                      id: 'obsidian',
                      name: language === 'zh' ? '极简黑曜石' : 'Obsidian',
                      desc: language === 'zh' ? '极致冷淡' : 'Minimalist',
                      colors: ['#1a1a1a', '#404040', '#737373']
                    },
                    {
                      id: 'warm',
                      name: language === 'zh' ? '暖石灰' : 'Warm Stone',
                      desc: language === 'zh' ? '温润阅读' : 'Warm',
                      colors: ['#78716c', '#a8a29e', '#d6d3d1']
                    }
                  ].map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setThemeColor(color.id as any)}
                      className={cn(
                        "relative p-4 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden group hover:-translate-y-1 hover:shadow-md",
                        themeColor === color.id
                          ? "border-primary bg-primary/5 shadow-sm ring-4 ring-primary/10"
                          : "border-border/50 hover:border-primary/40 bg-card"
                      )}
                    >
                      <div className="flex gap-1.5 mb-3">
                        {color.colors.map((c, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-md shadow-sm"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="text-sm font-semibold text-foreground mb-0.5">
                        {color.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {color.desc}
                      </div>
                      {themeColor === color.id && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audio Volume */}
        <Card className="border-none bg-muted/30 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <Volume2 size={20} className="text-foreground shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground mb-1">
                  {language === 'zh' ? '音频音量' : 'Audio Volume'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {language === 'zh' ? '控制 TTS 语音播放的音量大小' : 'Control TTS voice playback volume'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="flex-1 relative h-6 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-emerald-500 hover:accent-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div className="w-12 text-right">
                  <span className="text-sm font-bold text-primary">{volume}%</span>
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                <span>{language === 'zh' ? '静音' : 'Mute'}</span>
                <span>{language === 'zh' ? '最大' : 'Max'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audio Cache */}
        <Card className="border-none bg-muted/30 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <Database size={20} className="text-foreground shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground mb-1">
                  {language === 'zh' ? '音频缓存上限' : 'Audio Cache Limit'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {language === 'zh' ? '设置最多缓存多少条音频，超出后将删除最早的缓存' : 'Set maximum cached audio items'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 max-w-xs">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min="10"
                    max="200"
                    step="10"
                    value={audioCacheLimit}
                    onChange={(e) => handleCacheLimitChange(Number(e.target.value))}
                    className="w-full bg-card border-2 border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium uppercase">
                    {language === 'zh' ? '条' : 'items'}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                {language === 'zh' ? '建议值：10-100 条。缓存过多可能占用较多内存。' : 'Recommended: 10-100 items. Too many may consume more memory.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GeneralSettings;
