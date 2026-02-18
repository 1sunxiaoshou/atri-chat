import React, { useState } from 'react';
import { Button, Input, Select, Modal, ConfirmDialog, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui';
import { Bot, Send, Trash, Settings, Plus, Info, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, Brain, Thermometer, Mic, Volume2, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../utils/cn';

const StyleGuide: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('option1');

  return (
    <div className="container mx-auto py-10 px-4 space-y-16 pb-32 max-w-6xl animate-in fade-in duration-700">
      <header className="border-b border-border pb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Sparkles className="text-primary w-8 h-8" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-foreground">Design System</h1>
        </div>
        <p className="text-muted-foreground text-xl max-w-2xl leading-relaxed">
          The visual language of Atri Chat. Standardized UI components, semantic tokens, and interactive patterns.
        </p>
      </header>

      {/* Colors */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
          <h2 className="text-3xl font-black tracking-tight">Semantic Colors</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          <ColorSwatch name="Background" variable="bg-background border-border" desc="Page body background" />
          <ColorSwatch name="Foreground" variable="bg-foreground text-background" desc="Primary text color" />
          <ColorSwatch name="Primary" variable="bg-primary text-primary-foreground" desc="Brand/Action color" />
          <ColorSwatch name="Secondary" variable="bg-secondary text-secondary-foreground" desc="Subtle action color" />
          <ColorSwatch name="Muted" variable="bg-muted text-muted-foreground" desc="Background for components" />
          <ColorSwatch name="Accent" variable="bg-accent text-accent-foreground" desc="Highlight background" />
          <ColorSwatch name="Destructive" variable="bg-destructive text-destructive-foreground" desc="Danger/Error state" />
          <ColorSwatch name="Border" variable="bg-border" desc="Dividers & outlines" />
          <ColorSwatch name="Input" variable="bg-input border-border" desc="Form element border" />
          <ColorSwatch name="Card" variable="bg-card border-border shadow-sm" desc="Surface containers" />
        </div>
      </section>

      {/* Buttons */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
          <h2 className="text-3xl font-black tracking-tight">Interactive Elements</h2>
        </div>
        <Card className="bg-muted/10 border-border/50">
          <CardContent className="p-8 space-y-12">
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Button Variants</p>
              <div className="flex flex-wrap gap-4">
                <Button>Default Action</Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="outline">Outline Style</Button>
                <Button variant="ghost">Ghost Style</Button>
                <Button variant="destructive">Destructive Action</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Button Sizes</p>
                <div className="flex flex-wrap gap-4 items-center">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default Size</Button>
                  <Button size="lg">Large Scale</Button>
                  <Button size="icon" className="rounded-xl"><Plus size={18} /></Button>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Interactive States</p>
                <div className="flex flex-wrap gap-4">
                  <Button loading>Processing</Button>
                  <Button disabled>Disabled State</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Form Elements */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
          <h2 className="text-3xl font-black tracking-tight">Form Inputs</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-muted/10 border-border/50">
            <CardContent className="p-8 space-y-6">
              <Input
                label="Standard Input"
                placeholder="Enter your name..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                description="This is a helper text for the user."
              />
              <Input
                label="Search with Icon"
                placeholder="Find components..."
                icon={<Bot size={18} />}
              />
              <Input
                label="Protected Field"
                type="password"
                showPasswordToggle
                placeholder="Enter secure key"
              />
            </CardContent>
          </Card>
          <Card className="bg-muted/10 border-border/50">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dropdown Select</label>
                <Select
                  value={selectValue}
                  onChange={setSelectValue}
                  options={[
                    { label: 'GPT-4 Omni', value: 'option1', icon: <Sparkles size={14} className="text-primary" /> },
                    { label: 'Claude 3.5 Sonnet', value: 'option2', group: 'Advanced' },
                    { label: 'DeepSeek Reasoner', value: 'option3', group: 'Advanced' },
                  ]}
                  className="h-11"
                />
              </div>
              <Input
                label="Error Handling"
                error="Invalid API configuration detected"
                placeholder="Check your settings"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Chat Specific */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
          <h2 className="text-3xl font-black tracking-tight">Chat Patterns</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-muted/30 border-border/50 overflow-hidden group hover:border-primary/30 transition-all duration-300">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Brain size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Reasoning</span>
                </div>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Visualizing the AI thought process with dedicated containers and animations.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border/50 overflow-hidden group hover:border-primary/30 transition-all duration-300">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Thermometer size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Parameters</span>
                </div>
                <Settings size={16} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Standardized slider controls for model temperature and creative controls.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border/50 overflow-hidden group hover:border-primary/30 transition-all duration-300">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Mic size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Multimodal</span>
                </div>
                <Volume2 size={16} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Integrated ASR and TTS controls using consistent glassmorphism effects.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Overlays */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
          <h2 className="text-3xl font-black tracking-tight">Overlays & Dialogs</h2>
        </div>
        <div className="flex flex-wrap gap-6 items-center border border-border/50 p-12 rounded-3xl bg-muted/10">
          <Button size="lg" onClick={() => setIsModalOpen(true)} className="rounded-2xl h-14 px-8">Launch Modal Window</Button>
          <Button variant="outline" size="lg" onClick={() => setIsConfirmOpen(true)} className="rounded-2xl h-14 px-8">Trigger Safety Check</Button>

          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="System Configuration"
          >
            <div className="p-8 space-y-6">
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-4">
                <Info className="text-primary shrink-0" />
                <p className="text-sm text-foreground leading-relaxed">
                  Modals use backdrop-blur and centered layouts to focus the user attention on critical tasks.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={() => setIsModalOpen(false)}>Apply Changes</Button>
              </div>
            </div>
          </Modal>

          <ConfirmDialog
            isOpen={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            onConfirm={() => setIsConfirmOpen(false)}
            title="Destructive Action?"
            description="You are about to permanently delete this character data. This operation is irreversible and will affect all linked conversations."
            type="danger"
            confirmText="Proceed with Deletion"
          />
        </div>
      </section>

      {/* Theme Toggle Example */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
          <h2 className="text-3xl font-black tracking-tight">Theme Adaptation</h2>
        </div>
        <Card className="bg-muted/10 border-border/50 overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-wrap gap-4">
              <div className="flex p-1 bg-muted rounded-2xl ring-1 ring-border/50 w-full max-w-sm">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-background text-primary shadow-lg ring-1 ring-border/20">
                  <Sun size={14} />
                  Light
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                  <Moon size={14} />
                  Dark
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                  <Monitor size={14} />
                  System
                </button>
              </div>
            </div>
            <p className="mt-6 text-sm text-muted-foreground italic">
              Components automatically adjust their HSL values based on the .dark class on the root element.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

const ColorSwatch: React.FC<{ name: string; variable: string; desc?: string }> = ({ name, variable, desc }) => (
  <Card className="overflow-hidden border-border/50 group">
    <div className={cn("h-24 w-full transition-transform group-hover:scale-105 duration-500", variable)} />
    <CardContent className="p-3 space-y-1">
      <p className="text-xs font-black uppercase tracking-widest text-foreground">{name}</p>
      {desc && <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>}
    </CardContent>
  </Card>
);

export default StyleGuide;
