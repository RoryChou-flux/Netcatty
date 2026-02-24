import React, { memo, useEffect, useState } from 'react';
import { useWindowControls } from '../application/state/useWindowControls';
import { WindowControls } from './WindowControls';

const dragRegionStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const dragRegionNoSelect = { WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties;

interface ThinTitlebarProps {
  isMacClient: boolean;
}

const ThinTitlebarInner: React.FC<ThinTitlebarProps> = ({ isMacClient }) => {
  const { maximize, isFullscreen, onFullscreenChanged } = useWindowControls();
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(false);

  useEffect(() => {
    if (!isMacClient) return;
    let cancelled = false;
    isFullscreen().then((value) => {
      if (!cancelled) setIsWindowFullscreen(!!value);
    });
    const unsubscribe = onFullscreenChanged((value) => setIsWindowFullscreen(!!value));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isFullscreen, isMacClient, onFullscreenChanged]);

  return (
    <div
      className="h-8 w-full bg-secondary border-b border-border/60 flex items-center app-drag"
      style={dragRegionNoSelect}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.app-no-drag')) return;
        if (!isMacClient) maximize();
      }}
    >
      {/* macOS: left padding for traffic lights */}
      {isMacClient && !isWindowFullscreen && <div className="w-[76px] flex-shrink-0" />}
      {isMacClient && isWindowFullscreen && <div className="w-3 flex-shrink-0" />}

      {/* Drag region spacer */}
      <div className="flex-1 h-full app-drag" style={dragRegionStyle} />

      {/* Windows/Linux: window controls on right */}
      {!isMacClient && <WindowControls />}

      {/* macOS: small right padding */}
      {isMacClient && <div className="w-2 flex-shrink-0" />}
    </div>
  );
};

export const ThinTitlebar = memo(ThinTitlebarInner);
ThinTitlebar.displayName = 'ThinTitlebar';
