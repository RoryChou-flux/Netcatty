import { Copy, Minus, Square, X } from 'lucide-react';
import React, { memo, useEffect, useState } from 'react';
import { useWindowControls } from '../application/state/useWindowControls';

const WindowControlsInner: React.FC = () => {
  const { minimize, maximize, close, isMaximized: fetchIsMaximized } = useWindowControls();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    fetchIsMaximized().then(v => setIsMaximized(!!v));
    const handleResize = () => {
      fetchIsMaximized().then(v => setIsMaximized(!!v));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fetchIsMaximized]);

  return (
    <div className="flex items-center app-drag">
      <button
        onClick={() => minimize()}
        className="h-8 w-10 flex items-center justify-center text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all duration-150 app-no-drag"
        title="Minimize"
      >
        <Minus size={16} />
      </button>
      <button
        onClick={async () => { const result = await maximize(); setIsMaximized(!!result); }}
        className="h-8 w-10 flex items-center justify-center text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all duration-150 app-no-drag"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? <Copy size={14} /> : <Square size={14} />}
      </button>
      <button
        onClick={() => close()}
        className="h-8 w-10 flex items-center justify-center text-muted-foreground hover:bg-red-500 hover:text-white transition-all duration-150 app-no-drag"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const WindowControls = memo(WindowControlsInner);
WindowControls.displayName = 'WindowControls';
