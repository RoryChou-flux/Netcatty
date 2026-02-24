import { Bell, FileText, Folder, LayoutGrid, Moon, MoreHorizontal, Plus, Shield, Sun, TerminalSquare, X } from 'lucide-react';
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { activeTabStore, useActiveTabId } from '../application/state/activeTabStore';
import { LogView } from '../application/state/useSessionState';
import { useWindowControls } from '../application/state/useWindowControls';
import { useI18n } from '../application/i18n/I18nProvider';
import { cn } from '../lib/utils';
import { TerminalSession, Workspace } from '../types';
import { Button } from './ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';
import { SyncStatusButton } from './SyncStatusButton';
import { WindowControls } from './WindowControls';

// Helper styles for Electron drag regions (use type assertion to include non-standard WebkitAppRegion)
const dragRegionStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const dragRegionNoSelect = { WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties;

interface TopTabsProps {
  theme: 'dark' | 'light';
  sessions: TerminalSession[];
  orphanSessions: TerminalSession[];
  workspaces: Workspace[];
  logViews: LogView[];
  orderedTabs: string[];
  draggingSessionId: string | null;
  isMacClient: boolean;
  orientation: 'horizontal' | 'vertical';
  barSize: number;
  onBarSizeChange: (size: number) => void;
  onOrientationChange: (orientation: 'horizontal' | 'vertical') => void;
  onCloseSession: (sessionId: string, e?: React.MouseEvent) => void;
  onRenameSession: (sessionId: string) => void;
  onCopySession: (sessionId: string) => void;
  onRenameWorkspace: (workspaceId: string) => void;
  onCloseWorkspace: (workspaceId: string) => void;
  onCloseLogView: (logViewId: string) => void;
  onOpenQuickSwitcher: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onSyncNow?: () => Promise<void>;
  onStartSessionDrag: (sessionId: string) => void;
  onEndSessionDrag: () => void;
  onReorderTabs: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
}

const sessionStatusDot = (status: TerminalSession['status']) => {
  const tone = status === 'connected'
    ? "bg-emerald-400"
    : status === 'connecting'
      ? "bg-amber-400"
      : "bg-rose-500";
  return <span className={cn("inline-block h-2 w-2 rounded-full ring-2 ring-background/60", tone)} />;
};

const TopTabsInner: React.FC<TopTabsProps> = ({
  theme,
  sessions,
  orphanSessions,
  workspaces,
  logViews,
  orderedTabs,
  draggingSessionId,
  isMacClient,
  orientation,
  barSize,
  onBarSizeChange,
  onOrientationChange,
  onCloseSession,
  onRenameSession,
  onCopySession,
  onRenameWorkspace,
  onCloseWorkspace,
  onCloseLogView,
  onOpenQuickSwitcher,
  onToggleTheme,
  onOpenSettings,
  onSyncNow,
  onStartSessionDrag,
  onEndSessionDrag,
  onReorderTabs,
}) => {
  const { t } = useI18n();
  const isVertical = orientation === 'vertical';
  // Subscribe to activeTabId from external store
  const { maximize, isFullscreen, onFullscreenChanged } = useWindowControls();
  const activeTabId = useActiveTabId();
  const isVaultActive = activeTabId === 'vault';
  const isSftpActive = activeTabId === 'sftp';
  const onSelectTab = activeTabStore.setActiveTabId;

  // Tab reorder drag state
  const [dropIndicator, setDropIndicator] = useState<{ tabId: string; position: 'before' | 'after' } | null>(null);
  const [isDraggingForReorder, setIsDraggingForReorder] = useState(false);
  const draggedTabIdRef = useRef<string | null>(null);
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

  // Refs for scrollable tab container
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const container = tabsContainerRef.current;
    if (container) {
      if (isVertical) {
        const hasScroll = container.scrollHeight > container.clientHeight;
        setHasOverflow(hasScroll);
        setCanScrollStart(container.scrollTop > 0);
        setCanScrollEnd(container.scrollTop < container.scrollHeight - container.clientHeight - 1);
      } else {
        const hasScroll = container.scrollWidth > container.clientWidth;
        setHasOverflow(hasScroll);
        setCanScrollStart(container.scrollLeft > 0);
        setCanScrollEnd(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
      }
    }
  }, [isVertical]);

  // Update scroll state on mount and resize
  useEffect(() => {
    updateScrollState();
    const container = tabsContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollState);
      const resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(container);
      return () => {
        container.removeEventListener('scroll', updateScrollState);
        resizeObserver.disconnect();
      };
    }
  }, [updateScrollState, orderedTabs]);

  // Scroll to active tab when it changes
  useLayoutEffect(() => {
    if (!activeTabId || activeTabId === 'vault' || activeTabId === 'sftp') return;
    const container = tabsContainerRef.current;
    if (!container) return;

    const activeTabElement = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    if (activeTabElement) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTabElement.getBoundingClientRect();

      if (isVertical) {
        if (tabRect.top < containerRect.top) {
          container.scrollTop -= (containerRect.top - tabRect.top + 8);
        } else if (tabRect.bottom > containerRect.bottom) {
          container.scrollTop += (tabRect.bottom - containerRect.bottom + 8);
        }
      } else {
        if (tabRect.left < containerRect.left) {
          container.scrollLeft -= (containerRect.left - tabRect.left + 8);
        } else if (tabRect.right > containerRect.right) {
          container.scrollLeft += (tabRect.right - containerRect.right + 8);
        }
      }
    }
    setTimeout(updateScrollState, 100);
  }, [activeTabId, updateScrollState, isVertical]);

  // Pre-compute lookup maps for O(1) access instead of O(n) find operations
  const orphanSessionMap = useMemo(() => {
    const map = new Map<string, TerminalSession>();
    for (const s of orphanSessions) map.set(s.id, s);
    return map;
  }, [orphanSessions]);

  const workspaceMap = useMemo(() => {
    const map = new Map<string, Workspace>();
    for (const w of workspaces) map.set(w.id, w);
    return map;
  }, [workspaces]);

  const logViewMap = useMemo(() => {
    const map = new Map<string, LogView>();
    for (const lv of logViews) map.set(lv.id, lv);
    return map;
  }, [logViews]);

  // Pre-compute session counts per workspace for O(1) access
  const workspacePaneCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.workspaceId) {
        counts.set(s.workspaceId, (counts.get(s.workspaceId) || 0) + 1);
      }
    }
    return counts;
  }, [sessions]);

  const handleTabDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('tab-reorder-id', tabId);
    const isOrphanSession = orphanSessionMap.has(tabId);
    if (isOrphanSession) {
      e.dataTransfer.setData('session-id', tabId);
    }
    draggedTabIdRef.current = tabId;
    setTimeout(() => {
      setIsDraggingForReorder(true);
    }, 0);
    onStartSessionDrag(tabId);
  }, [orphanSessionMap, onStartSessionDrag]);

  const handleTabDragEnd = useCallback(() => {
    draggedTabIdRef.current = null;
    setDropIndicator(null);
    setIsDraggingForReorder(false);
    onEndSessionDrag();
  }, [onEndSessionDrag]);

  const handleTabDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedTabIdRef.current || draggedTabIdRef.current === tabId) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    let position: 'before' | 'after';
    if (isVertical) {
      const midpoint = rect.top + rect.height / 2;
      position = e.clientY < midpoint ? 'before' : 'after';
    } else {
      const midpoint = rect.left + rect.width / 2;
      position = e.clientX < midpoint ? 'before' : 'after';
    }

    setDropIndicator({ tabId, position });
  }, [isVertical]);

  const handleTabDragLeave = useCallback((_e: React.DragEvent) => {
    // Don't clear - let onDragOver manage it
  }, []);

  const handleTabDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('tab-reorder-id') || draggedTabIdRef.current;

    if (draggedId && draggedId !== targetTabId && dropIndicator) {
      onReorderTabs(draggedId, targetTabId, dropIndicator.position);
    }

    setDropIndicator(null);
    setIsDraggingForReorder(false);
  }, [dropIndicator, onReorderTabs]);

  // Pre-compute tab shift styles
  const tabShiftStyles = useMemo(() => {
    if (!dropIndicator || !isDraggingForReorder || !draggedTabIdRef.current) {
      return {};
    }
    const styles: Record<string, React.CSSProperties> = {};
    const draggedIndex = orderedTabs.indexOf(draggedTabIdRef.current);
    const targetIndex = orderedTabs.indexOf(dropIndicator.tabId);
    const dropIndex = dropIndicator.position === 'before' ? targetIndex : targetIndex + 1;
    const translateProp = isVertical ? 'translateY' : 'translateX';

    for (let i = 0; i < orderedTabs.length; i++) {
      const tabId = orderedTabs[i];
      if (tabId === draggedTabIdRef.current) continue;

      if (draggedIndex < dropIndex) {
        if (i > draggedIndex && i < dropIndex) {
          styles[tabId] = { transform: `${translateProp}(-8px)` };
        }
      } else {
        if (i >= dropIndex && i < draggedIndex) {
          styles[tabId] = { transform: `${translateProp}(8px)` };
        }
      }
    }
    return styles;
  }, [dropIndicator, isDraggingForReorder, orderedTabs, isVertical]);

  // Build ordered tab items using pre-computed maps for O(1) lookups
  const orderedTabItems = useMemo(() => {
    return orderedTabs.map((tabId) => {
      const session = orphanSessionMap.get(tabId);
      const workspace = workspaceMap.get(tabId);
      const logView = logViewMap.get(tabId);
      if (session) {
        return { type: 'session' as const, id: tabId, session };
      }
      if (workspace) {
        return { type: 'workspace' as const, id: tabId, workspace, paneCount: workspacePaneCounts.get(tabId) || 0 };
      }
      if (logView) {
        return { type: 'logView' as const, id: tabId, logView };
      }
      return null;
    }).filter(Boolean);
  }, [orderedTabs, orphanSessionMap, workspaceMap, logViewMap, workspacePaneCounts]);

  // Tab item class names based on orientation
  const tabCn = isVertical
    ? "relative h-8 px-2 w-full rounded-md border text-xs font-semibold cursor-pointer flex items-center justify-between gap-2 app-no-drag flex-shrink-0"
    : "relative h-6 pl-3 pr-2 min-w-[140px] max-w-[240px] rounded-md border text-xs font-semibold cursor-pointer flex items-center justify-between gap-2 app-no-drag flex-shrink-0";

  const workspaceTabCn = isVertical
    ? "relative h-8 px-2 w-full rounded-md border text-xs font-semibold cursor-pointer flex items-center justify-between gap-2 app-no-drag flex-shrink-0"
    : "relative h-6 pl-3 pr-2 min-w-[150px] max-w-[260px] rounded-md border text-xs font-semibold cursor-pointer flex items-center justify-between gap-2 app-no-drag flex-shrink-0";

  // Drop indicator classes based on orientation
  const dropBeforeCn = isVertical
    ? "absolute -top-1.5 left-1 right-1 h-0.5 bg-primary rounded-full shadow-[0_0_8px_2px] shadow-primary/50 animate-pulse"
    : "absolute -left-1.5 top-1 bottom-1 w-0.5 bg-primary rounded-full shadow-[0_0_8px_2px] shadow-primary/50 animate-pulse";

  const dropAfterCn = isVertical
    ? "absolute -bottom-1.5 left-1 right-1 h-0.5 bg-primary rounded-full shadow-[0_0_8px_2px] shadow-primary/50 animate-pulse"
    : "absolute -right-1.5 top-1 bottom-1 w-0.5 bg-primary rounded-full shadow-[0_0_8px_2px] shadow-primary/50 animate-pulse";

  // Render the tabs
  const renderOrderedTabs = () => {
    return orderedTabItems.map((item) => {
      if (!item) return null;

      if (item.type === 'session') {
        const session = item.session;
        const isBeingDragged = draggingSessionId === session.id;
        const shiftStyle = tabShiftStyles[session.id] || {};
        const showDropIndicatorBefore = dropIndicator?.tabId === session.id && dropIndicator.position === 'before';
        const showDropIndicatorAfter = dropIndicator?.tabId === session.id && dropIndicator.position === 'after';

        return (
          <ContextMenu key={session.id}>
            <ContextMenuTrigger asChild>
              <div
                data-tab-id={session.id}
                onClick={() => onSelectTab(session.id)}
                draggable
                onDragStart={(e) => handleTabDragStart(e, session.id)}
                onDragEnd={handleTabDragEnd}
                onDragOver={(e) => handleTabDragOver(e, session.id)}
                onDragLeave={handleTabDragLeave}
                onDrop={(e) => handleTabDrop(e, session.id)}
                className={cn(
                  tabCn,
                  "transition-all duration-200 ease-out",
                  activeTabId === session.id ? "bg-accent/20 text-foreground" : "border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground",
                  isBeingDragged && isDraggingForReorder ? "opacity-40 scale-95" : ""
                )}
                style={{
                  ...shiftStyle,
                  ...(activeTabId === session.id ? { borderColor: 'hsl(var(--accent))' } : {})
                }}
              >
                {showDropIndicatorBefore && isDraggingForReorder && <div className={dropBeforeCn} />}
                {showDropIndicatorAfter && isDraggingForReorder && <div className={dropAfterCn} />}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <TerminalSquare size={14} className={cn("shrink-0", activeTabId === session.id ? "text-accent" : "text-muted-foreground")} />
                  <span className="truncate">{session.hostLabel}</span>
                  <div className="flex-shrink-0">{sessionStatusDot(session.status)}</div>
                </div>
                <button
                  onClick={(e) => onCloseSession(session.id, e)}
                  className="p-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                  aria-label={t('tabs.closeSessionAria')}
                >
                  <X size={12} />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onRenameSession(session.id)}>
                {t('common.rename')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCopySession(session.id)}>
                {t('tabs.copyTab')}
              </ContextMenuItem>
              <ContextMenuItem className="text-destructive" onClick={() => onCloseSession(session.id)}>
                {t('common.close')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      }

      if (item.type === 'workspace') {
        const workspace = item.workspace;
        const paneCount = item.paneCount;
        const isActive = activeTabId === workspace.id;
        const isBeingDragged = draggingSessionId === workspace.id;
        const shiftStyle = tabShiftStyles[workspace.id] || {};
        const showDropIndicatorBefore = dropIndicator?.tabId === workspace.id && dropIndicator.position === 'before';
        const showDropIndicatorAfter = dropIndicator?.tabId === workspace.id && dropIndicator.position === 'after';

        return (
          <ContextMenu key={workspace.id}>
            <ContextMenuTrigger asChild>
              <div
                data-tab-id={workspace.id}
                onClick={() => onSelectTab(workspace.id)}
                draggable
                onDragStart={(e) => handleTabDragStart(e, workspace.id)}
                onDragEnd={handleTabDragEnd}
                onDragOver={(e) => handleTabDragOver(e, workspace.id)}
                onDragLeave={handleTabDragLeave}
                onDrop={(e) => handleTabDrop(e, workspace.id)}
                className={cn(
                  workspaceTabCn,
                  "transition-all duration-200 ease-out",
                  isActive ? "bg-accent/20 text-foreground" : "border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground",
                  isBeingDragged && isDraggingForReorder ? "opacity-40 scale-95" : ""
                )}
                style={{
                  ...shiftStyle,
                  ...(isActive ? { borderColor: 'hsl(var(--accent))' } : {})
                }}
              >
                {showDropIndicatorBefore && isDraggingForReorder && <div className={dropBeforeCn} />}
                {showDropIndicatorAfter && isDraggingForReorder && <div className={dropAfterCn} />}
                <div className="flex items-center gap-2 truncate">
                  <LayoutGrid size={14} className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{workspace.title}</span>
                </div>
                <div className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/70 bg-background/60 min-w-[22px] text-center">
                  {paneCount}
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onRenameWorkspace(workspace.id)}>
                {t('common.rename')}
              </ContextMenuItem>
              <ContextMenuItem className="text-destructive" onClick={() => onCloseWorkspace(workspace.id)}>
                {t('common.close')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      }

      if (item.type === 'logView') {
        const logView = item.logView;
        const isActive = activeTabId === logView.id;
        const isLocal = logView.log.protocol === 'local' || logView.log.hostname === 'localhost';

        return (
          <div
            key={logView.id}
            data-tab-id={logView.id}
            onClick={() => onSelectTab(logView.id)}
            className={cn(
              tabCn,
              "transition-all duration-200 ease-out",
              isActive ? "bg-accent/20 text-foreground" : "border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground"
            )}
            style={isActive ? { borderColor: 'hsl(var(--accent))' } : {}}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText size={14} className={cn("shrink-0", isActive ? "text-accent" : "text-muted-foreground")} />
              <span className="truncate">
                {t('tabs.logPrefix')} {isLocal ? t('tabs.logLocal') : logView.log.hostname}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseLogView(logView.id);
              }}
              className="p-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label={t('tabs.closeLogViewAria')}
            >
              <X size={12} />
            </button>
          </div>
        );
      }

      return null;
    });
  };

  // Handle double-click on titlebar to maximize/restore window (Windows/Linux)
  const handleTitleBarDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.app-no-drag')) return;
    if (!isMacClient) {
      maximize();
    }
  }, [isMacClient, maximize]);

  // Lightweight bar-level context menu (avoids heavy Radix ContextMenu portal/animation overhead)
  const [barMenuPos, setBarMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleBarContextMenu = useCallback((e: React.MouseEvent) => {
    // Only show on blank area (not on tab elements or buttons which have their own menus)
    if ((e.target as HTMLElement).closest('[data-tab-id]') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setBarMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  // Resize handle logic – use ref + direct DOM mutation during drag to avoid per-frame React re-renders.
  // Only commit the final size via onBarSizeChange on mouseup.
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ startPos: number; startSize: number } | null>(null);
  const resizeContainerRef = useRef<HTMLDivElement>(null);
  const resizeInnerRef = useRef<HTMLDivElement>(null);
  const liveSizeRef = useRef(barSize);
  // Sync from prop when NOT dragging – runs as a layout effect to avoid render-phase side effects
  useLayoutEffect(() => {
    if (!isResizing) {
      liveSizeRef.current = barSize;
    }
  }, [barSize, isResizing]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startPos = isVertical ? e.clientX : e.clientY;
    resizeStartRef.current = { startPos, startSize: liveSizeRef.current };
    setIsResizing(true);
  }, [isVertical]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const { startPos, startSize } = resizeStartRef.current;
      let newSize: number;
      if (isVertical) {
        const delta = e.clientX - startPos;
        newSize = Math.max(140, Math.min(400, startSize + delta));
      } else {
        const delta = e.clientY - startPos;
        newSize = Math.max(32, Math.min(64, startSize + delta));
      }
      liveSizeRef.current = newSize;
      // Direct DOM mutation – skip React reconciliation during drag
      if (isVertical) {
        const el = resizeContainerRef.current;
        if (el) el.style.width = `${newSize}px`;
      } else {
        const inner = resizeInnerRef.current;
        if (inner) inner.style.height = `${newSize}px`;
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onBarSizeChange(liveSizeRef.current);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isVertical, onBarSizeChange]);

  // Bar-level context menu overlay (shared between both layouts)
  const barContextMenuOverlay = barMenuPos && (
    <div
      className="fixed inset-0 z-[200000]"
      onClick={() => setBarMenuPos(null)}
      onContextMenu={(e) => { e.preventDefault(); setBarMenuPos(null); }}
    >
      <div
        className="absolute min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        style={{ left: barMenuPos.x, top: barMenuPos.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            onOrientationChange(isVertical ? 'horizontal' : 'vertical');
            setBarMenuPos(null);
          }}
        >
          {isVertical ? t('tabs.switchToHorizontal') : t('tabs.switchToVertical')}
        </div>
      </div>
    </div>
  );

  // ─── VERTICAL LAYOUT ───
  if (isVertical) {
    return (
      <>
        <div
          ref={resizeContainerRef}
          className="relative h-full bg-secondary border-r border-border/60 flex flex-col"
          style={{ width: barSize }}
          onContextMenu={handleBarContextMenu}
        >
            {/* Fixed top: Vaults and SFTP */}
            <div className="flex flex-col gap-1 px-2 pt-2 flex-shrink-0">
              <div
                onClick={() => onSelectTab('vault')}
                className={cn(
                  "h-8 px-2 rounded-md border text-xs font-semibold cursor-pointer flex items-center gap-2 app-no-drag w-full",
                  isVaultActive ? "bg-accent/20 text-foreground" : "border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                )}
                style={isVaultActive ? { borderColor: 'hsl(var(--accent))' } : undefined}
              >
                <Shield size={14} /> Vaults
              </div>
              <div
                onClick={() => onSelectTab('sftp')}
                className={cn(
                  "h-8 px-2 rounded-md border text-xs font-semibold cursor-pointer flex items-center gap-2 app-no-drag w-full",
                  isSftpActive ? "bg-accent/20 text-foreground" : "border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                )}
                style={isSftpActive ? { borderColor: 'hsl(var(--accent))' } : undefined}
              >
                <Folder size={14} /> SFTP
              </div>
            </div>

            {/* Scrollable tabs container with fade masks */}
            <div
              className="relative flex-1 min-h-0 flex flex-col px-2 py-1"
              onDragOver={(e) => {
                if (draggedTabIdRef.current && isDraggingForReorder && !dropIndicator) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
            >
              {/* Top fade mask */}
              {canScrollStart && (
                <div
                  className="absolute left-0 right-0 top-0 h-8 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to bottom, hsl(var(--secondary) / 0.9), transparent)' }}
                />
              )}

              {/* Scrollable container */}
              <div
                ref={tabsContainerRef}
                className="flex flex-col gap-1 overflow-y-auto scrollbar-none flex-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {renderOrderedTabs()}
                {/* Add new tab button */}
                {!hasOverflow && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-full flex-shrink-0 app-no-drag"
                    onClick={onOpenQuickSwitcher}
                    title="Open quick switcher"
                  >
                    <Plus size={14} />
                  </Button>
                )}
              </div>

              {/* Bottom fade mask */}
              {canScrollEnd && (
                <div
                  className="absolute left-0 right-0 bottom-0 h-8 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to top, hsl(var(--secondary) / 0.9), transparent)' }}
                />
              )}
            </div>

            {/* More tabs button - only when overflowing */}
            {hasOverflow && (
              <div className="px-2 pb-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-full flex-shrink-0 app-no-drag"
                  onClick={onOpenQuickSwitcher}
                  title="More tabs"
                >
                  <MoreHorizontal size={14} />
                </Button>
              </div>
            )}

            {/* Fixed bottom controls */}
            <div className="flex flex-col gap-1 px-2 pb-2 flex-shrink-0 border-t border-border/40 pt-2">
              <div className="flex items-center justify-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground app-no-drag">
                  <Bell size={14} />
                </Button>
                <SyncStatusButton onOpenSettings={onOpenSettings} onSyncNow={onSyncNow} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground app-no-drag"
                  onClick={onToggleTheme}
                  title="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </Button>
              </div>
            </div>

            {/* Resize handle - right edge */}
            <div
              className={cn(
                "absolute top-0 right-0 w-1 h-full cursor-ew-resize z-20 group app-no-drag",
                isResizing ? "bg-primary/50" : "hover:bg-primary/30"
              )}
              onMouseDown={handleResizeMouseDown}
            />
          </div>
        {barContextMenuOverlay}
      </>
    );
  }

  // ─── HORIZONTAL LAYOUT (default) ───
  return (
    <>
      <div
        ref={resizeContainerRef}
        className="relative w-full bg-secondary border-b border-border/60 app-drag"
        style={dragRegionNoSelect}
        onDoubleClick={handleTitleBarDoubleClick}
        onContextMenu={handleBarContextMenu}
      >
          {/* Always-on drag stripe so the window can be moved even when tabs fill the bar */}
          <div className="absolute inset-x-0 top-0 h-1 app-drag pointer-events-auto z-10" style={dragRegionStyle} aria-hidden />
          <div
            ref={resizeInnerRef}
            className="flex items-center gap-2 h-8 app-drag"
            style={{ ...dragRegionStyle, paddingLeft: isMacClient && !isWindowFullscreen ? 76 : 12, paddingRight: isMacClient ? 12 : 0 }}
          >
            {/* Fixed left tabs: Vaults and SFTP */}
            <div className="flex items-center gap-2 flex-shrink-0 app-drag">
              <div
                onClick={() => onSelectTab('vault')}
                className={cn(
                  "h-6 px-3 rounded-md border text-xs font-semibold cursor-pointer flex items-center gap-2 app-no-drag",
                  isVaultActive ? "bg-accent/20 text-foreground" : "border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                )}
                style={isVaultActive ? { borderColor: 'hsl(var(--accent))' } : undefined}
              >
                <Shield size={14} /> Vaults
              </div>
              <div
                onClick={() => onSelectTab('sftp')}
                className={cn(
                  "h-6 px-3 rounded-md border text-xs font-semibold cursor-pointer flex items-center gap-2 app-no-drag",
                  isSftpActive ? "bg-accent/20 text-foreground" : "border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                )}
                style={isSftpActive ? { borderColor: 'hsl(var(--accent))' } : undefined}
              >
                <Folder size={14} /> SFTP
              </div>
            </div>

            {/* Scrollable tabs container with fade masks */}
            <div
              className="relative min-w-0 flex-1 flex app-drag"
              style={dragRegionStyle}
              onDragOver={(e) => {
                if (draggedTabIdRef.current && isDraggingForReorder && !dropIndicator) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
            >
              {/* Left fade mask */}
              {canScrollStart && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to right, hsl(var(--secondary) / 0.9), transparent)' }}
                />
              )}

              {/* Scrollable container */}
              <div
                ref={tabsContainerRef}
                className="flex items-center gap-2 overflow-x-auto scrollbar-none app-drag max-w-full"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {renderOrderedTabs()}
                {!hasOverflow && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 app-no-drag"
                    onClick={onOpenQuickSwitcher}
                    title="Open quick switcher"
                  >
                    <Plus size={14} />
                  </Button>
                )}
                <div className="min-w-[20px] h-6 app-drag flex-shrink-0" style={dragRegionStyle} />
              </div>

              {/* Right fade mask */}
              {canScrollEnd && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to left, hsl(var(--secondary) / 0.9), transparent)' }}
                />
              )}
            </div>

            {/* More tabs button - only when overflowing */}
            {hasOverflow && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 app-no-drag"
                onClick={onOpenQuickSwitcher}
                title="More tabs"
              >
                <MoreHorizontal size={14} />
              </Button>
            )}

            {/* Fixed right controls */}
            <div className="flex-shrink-0 flex items-center gap-2 app-drag" style={dragRegionStyle}>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground app-no-drag">
                <Bell size={16} />
              </Button>
              <SyncStatusButton onOpenSettings={onOpenSettings} onSyncNow={onSyncNow} />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground app-no-drag"
                onClick={onToggleTheme}
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
            </div>
            {/* Custom window controls for Windows/Linux */}
            {!isMacClient && <WindowControls />}
            {/* Small drag shim to the right edge (macOS only – on Windows the close button should touch the edge) */}
            {isMacClient && <div className="w-2 h-8 app-drag flex-shrink-0" />}
          </div>
        </div>
      {barContextMenuOverlay}
    </>
  );
};

// Custom comparison: only re-render when data props change.
// Callback props (onSyncNow, onOpenSettings, etc.) are intentionally excluded –
// their identity changes with data (via useCallback deps) but doesn't affect visual output.
// Including them would cause spurious re-renders on every hosts/keys/snippets change.
const topTabsAreEqual = (prev: TopTabsProps, next: TopTabsProps): boolean => {
  return (
    prev.theme === next.theme &&
    prev.sessions === next.sessions &&
    prev.orphanSessions === next.orphanSessions &&
    prev.workspaces === next.workspaces &&
    prev.orderedTabs === next.orderedTabs &&
    prev.draggingSessionId === next.draggingSessionId &&
    prev.isMacClient === next.isMacClient &&
    prev.orientation === next.orientation &&
    prev.barSize === next.barSize
  );
};

export const TopTabs = memo(TopTabsInner, topTabsAreEqual);
TopTabs.displayName = 'TopTabs';
