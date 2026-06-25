'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Type, 
  ArrowRight, 
  ArrowLeft, 
  Trash2, 
  X, 
  Image as ImageIcon, 
  Key, 
  Move, 
  RotateCcw,
  Info,
  Maximize2
} from 'lucide-react';

interface CanvasElement {
  id: string;
  type: 'image' | 'text';
  content: string; // Base64 data URL for images, text string for text elements
  x: number; // percentage left (0 to 100)
  y: number; // percentage top (0 to 100)
  width: number; // width in pixels
  height: number; // height in pixels
  fontSize: number; // font size in pixels (for text)
  screen: 1 | 2;
  zIndex: number;
}

export default function InteractiveCanvas() {
  // Passcode state
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('skysnap_unlocked') === 'true';
    }
    return false;
  });
  const [passcode, setPasscode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const hasLoadedRef = useRef<boolean>(false);

  // App state
  const [currentScreen, setCurrentScreen] = useState<1 | 2>(1);
  const [elements, setElements] = useState<CanvasElement[]>(() => {
    if (typeof window !== 'undefined') {
      const savedElements = localStorage.getItem('skysnap_canvas_elements');
      if (savedElements) {
        try {
          return JSON.parse(savedElements) as CanvasElement[];
        } catch (e) {
          console.error('Failed to parse saved canvas elements', e);
        }
      }
    }
    return [];
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextZIndex, setNextZIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedElements = localStorage.getItem('skysnap_canvas_elements');
      if (savedElements) {
        try {
          const parsed = JSON.parse(savedElements) as CanvasElement[];
          const maxZ = parsed.reduce((max, el) => Math.max(max, el.zIndex), 0);
          return maxZ + 1;
        } catch (e) {}
      }
    }
    return 1;
  });
  const [showHelp, setShowHelp] = useState<boolean>(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

  // Correct passcode (kept simple and minimalist)
  const CORRECT_PASSCODE = 'sky';

  // Mark loading complete on mount
  useEffect(() => {
    hasLoadedRef.current = true;
  }, []);

  // Save elements to local storage on change
  useEffect(() => {
    if (hasLoadedRef.current && isUnlocked) {
      localStorage.setItem('skysnap_canvas_elements', JSON.stringify(elements));
    }
  }, [elements, isUnlocked]);

  // Handle password submission
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPasscode = passcode.trim().toLowerCase();
    
    if (cleanPasscode === CORRECT_PASSCODE || cleanPasscode === 'skysnap' || cleanPasscode === 'admin') {
      setIsUnlocked(true);
      setErrorMsg('');
      localStorage.setItem('skysnap_unlocked', 'true');
    } else {
      setErrorMsg('Incorrect passcode. Hint: Use "sky"');
      setPasscode('');
    }
  };

  const handleLogout = () => {
    setIsUnlocked(false);
    setPasscode('');
    localStorage.removeItem('skysnap_unlocked');
  };

  // Helper to process and optimize image/GIF files
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const resultStr = event.target?.result as string;
        
        // If it's a GIF, keep the original base64 to preserve animation!
        if (file.type === 'image/gif') {
          resolve(resultStr);
          return;
        }

        // For other images, let's downscale them to a reasonable size (max 1000px)
        // to keep the base64 compact and ensure localStorage capacity is respected.
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 1000;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL(file.type || 'image/jpeg', 0.85);
            resolve(compressed);
          } else {
            resolve(resultStr);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = resultStr;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Trigger file selection dialog
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle image upload and element creation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        const base64Content = await processImageFile(file);
        
        // Create element centered in viewport with slight scatter
        const scatterOffset = (elements.filter(el => el.screen === currentScreen).length % 5) * 15;
        const initialX = 30 + (scatterOffset / window.innerWidth) * 100;
        const initialY = 30 + (scatterOffset / window.innerHeight) * 100;

        const newElement: CanvasElement = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'image',
          content: base64Content,
          x: Math.max(5, Math.min(80, initialX)),
          y: Math.max(5, Math.min(80, initialY)),
          width: 240,
          height: 240,
          fontSize: 16,
          screen: currentScreen,
          zIndex: nextZIndex,
        };

        setElements(prev => [...prev, newElement]);
        setSelectedId(newElement.id);
        setNextZIndex(prev => prev + 1);
        setShowHelp(false);
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }

    // Reset input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add text element
  const handleAddText = () => {
    const scatterOffset = (elements.filter(el => el.screen === currentScreen).length % 5) * 15;
    const initialX = 40 + (scatterOffset / window.innerWidth) * 100;
    const initialY = 40 + (scatterOffset / window.innerHeight) * 100;

    const newElement: CanvasElement = {
      id: `txt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      content: 'Double-click to edit text',
      x: Math.max(5, Math.min(85, initialX)),
      y: Math.max(5, Math.min(85, initialY)),
      width: 200,
      height: 80,
      fontSize: 22,
      screen: currentScreen,
      zIndex: nextZIndex,
    };

    setElements(prev => [...prev, newElement]);
    setSelectedId(newElement.id);
    setEditingId(newElement.id);
    setNextZIndex(prev => prev + 1);
    setShowHelp(false);

    // Auto focus textarea
    setTimeout(() => {
      const textarea = textInputRefs.current[newElement.id];
      if (textarea) {
        textarea.focus();
        textarea.select();
      }
    }, 50);
  };

  // Update element properties
  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  // Delete element
  const handleDeleteElement = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedId(current => current === id ? null : current);
    setEditingId(current => current === id ? null : current);
  }, []);

  // Clear current board
  const handleClearScreen = () => {
    if (window.confirm(`Are you sure you want to clear all elements from Screen ${currentScreen}?`)) {
      setElements(prev => prev.filter(el => el.screen !== currentScreen));
      setSelectedId(null);
      setEditingId(null);
    }
  };

  // Reset entire application boards
  const handleResetApp = () => {
    if (window.confirm('Reset both screens back to blank? All added items will be permanently removed.')) {
      setElements([]);
      setSelectedId(null);
      setEditingId(null);
    }
  };

  // Handle clicking on the canvas background to deselect elements
  const handleCanvasClick = (e: React.MouseEvent) => {
    // If we click on the canvas itself and not any draggable elements
    if (e.target === canvasRef.current || (e.target as HTMLElement).id === 'grid-overlay') {
      setSelectedId(null);
      setEditingId(null);
    }
  };

  // Unified Pointer Event Drag Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, elementId: string) => {
    // Do not drag if clicking on a button, textarea, or resize handle
    const target = e.target as HTMLElement;
    if (target.closest('.no-drag') || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') {
      return;
    }

    e.preventDefault();
    setSelectedId(elementId);
    
    // Bring element to the top by incrementing zIndex
    const currentZ = nextZIndex;
    updateElement(elementId, { zIndex: currentZ });
    setNextZIndex(prev => prev + 1);

    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const startX = e.clientX;
    const startY = e.clientY;
    const startElX = element.x;
    const startElY = element.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      // Convert pixel delta to percentage
      const dxPercent = (dx / rect.width) * 100;
      const dyPercent = (dy / rect.height) * 100;

      // Keep elements slightly constrained on-screen
      const newX = Math.max(0, Math.min(95, startElX + dxPercent));
      const newY = Math.max(0, Math.min(95, startElY + dyPercent));

      updateElement(elementId, { x: newX, y: newY });
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  // Drag handler for resizing elements
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, elementId: string) => {
    e.stopPropagation();
    e.preventDefault();

    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.width;
    const startHeight = element.height;
    const startFontSize = element.fontSize;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (element.type === 'image') {
        // Enforce square proportions or direct sizing based on diagonal drag
        const sizeDelta = Math.max(dx, dy);
        const newSize = Math.max(60, Math.min(1200, startWidth + sizeDelta));
        updateElement(elementId, { 
          width: newSize, 
          height: newSize 
        });
      } else {
        // Resize text elements (font size) based on horizontal drag
        const newFontSize = Math.max(12, Math.min(120, startFontSize + dx * 0.25));
        // Scale container width/height proportionally to font size to avoid clipping
        const ratio = newFontSize / startFontSize;
        updateElement(elementId, { 
          fontSize: newFontSize,
          width: Math.max(100, startWidth * ratio),
          height: Math.max(40, startHeight * ratio)
        });
      }
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  // Keyboard accessibility for selected items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId || editingId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteElement(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingId, handleDeleteElement]);

  return (
    <main className="relative min-h-screen w-full select-none overflow-hidden bg-black text-white font-sans" id="canvas-app">
      <AnimatePresence mode="wait">
        {!isUnlocked ? (
          // --- LANDING PASSWORD SCREEN ---
          <motion.div
            key="lock-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex min-h-screen w-full flex-col items-center justify-center bg-black px-4"
            id="password-screen"
          >
            <div className="z-10 w-full max-w-md flex flex-col items-center" id="auth-card-container">
              {/* Header */}
              <div className="mb-12 text-center" id="auth-header">
                <h1 className="text-sm font-light tracking-[0.4em] text-zinc-400 uppercase">
                  MINIMALIST CANVAS
                </h1>
              </div>

              {/* Form */}
              <motion.div
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full flex flex-col items-center"
                id="form-card"
              >
                <form onSubmit={handleUnlock} className="flex flex-col items-center space-y-8 w-full" id="passcode-form">
                  <div className="flex flex-col items-center w-full" id="input-group">
                    <input
                      type="password"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="PASSWORD"
                      className="w-[300px] bg-transparent border-0 border-b border-white/30 text-white text-2xl py-2.5 text-center tracking-[8px] outline-none transition-all duration-300 focus:border-b-white placeholder-zinc-700 font-sans"
                      autoFocus
                      id="passcode-input"
                    />
                  </div>

                  {errorMsg && (
                    <p className="text-center text-xs font-medium text-red-400 font-mono tracking-wider" id="error-message">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn-minimal bg-transparent border border-white/50 text-white px-10 py-3 text-xs uppercase tracking-[2px] font-sans hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
                    id="submit-button"
                  >
                    Enter Space
                  </button>
                </form>

                {/* Direct Hint */}
                <div className="mt-8 text-center" id="hint-container">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                    <Info className="h-3 w-3" />
                    passcode: <strong className="text-zinc-500 font-semibold ml-1">sky</strong>
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          // --- MAIN BOARD SCREEN WORKSPACE ---
          <motion.div
            key="workspace-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative flex min-h-screen w-full flex-col bg-black overflow-hidden"
            id="workspace-layout"
          >
            {/* Subtle Grid Pattern Overlay */}
            <div 
              id="grid-overlay"
              className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" 
            />

            {/* --- TOP TOOLBAR --- */}
            <div className="pointer-events-none absolute top-8 left-0 right-0 z-50 flex justify-center px-4" id="top-toolbar-wrapper">
              <div 
                className="pointer-events-auto flex items-center gap-4"
                id="top-toolbar"
              >
                {/* Add Image Button */}
                <button
                  onClick={triggerFileInput}
                  className="flex h-[45px] w-[45px] items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:border-white transition-all cursor-pointer hover:bg-white hover:text-black"
                  title="Add Image or GIF"
                  id="btn-add-image"
                >
                  <Plus className="h-5 w-5" />
                </button>

                {/* Add Text Button */}
                <button
                  onClick={handleAddText}
                  className="flex h-[45px] w-[45px] items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:border-white transition-all cursor-pointer font-sans font-medium text-lg hover:bg-white hover:text-black"
                  title="Add Text Block"
                  id="btn-add-text"
                >
                  T
                </button>

                {/* Clear Active Screen Board */}
                <button
                  onClick={handleClearScreen}
                  className="flex h-[45px] w-[45px] items-center justify-center rounded-full border border-white/30 bg-black/50 text-zinc-400 hover:border-red-500 hover:text-red-400 transition-all cursor-pointer hover:bg-red-950/20"
                  title="Clear Current Board"
                  id="btn-clear-board"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {/* Log Out Lock Button */}
                <button
                  onClick={handleLogout}
                  className="flex h-[45px] w-[45px] items-center justify-center rounded-full border border-white/30 bg-black/50 text-zinc-400 hover:border-white hover:text-white transition-all cursor-pointer hover:bg-zinc-900"
                  title="Lock Canvas"
                  id="btn-lock-canvas"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              className="hidden"
              id="hidden-file-input"
            />

            {/* --- CORE WORKING CANVAS --- */}
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="relative flex-1 w-full overflow-hidden"
              style={{ minHeight: 'calc(100vh - 80px)' }}
              id="canvas-drawing-area"
            >
              {/* Screen Content Wrapper with sliding transition */}
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={currentScreen}
                  initial={{ opacity: 0, x: currentScreen === 1 ? -40 : 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: currentScreen === 1 ? 40 : -40 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                  className="absolute inset-0 w-full h-full"
                  id={`screen-container-${currentScreen}`}
                >
                  {/* Empty State Banner */}
                  {elements.filter(el => el.screen === currentScreen).length === 0 && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-6" id="empty-state">
                      <div className="mb-4 rounded-full border border-white/10 bg-zinc-950/45 p-5 text-zinc-600">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                      <h2 className="text-xs tracking-[0.25em] text-zinc-500 uppercase font-sans">
                        Canvas Screen {currentScreen} is Empty
                      </h2>
                      <p className="mt-2 text-[10px] text-zinc-600 max-w-xs uppercase tracking-wider font-sans">
                        Tap the + to add images/GIFs, or T to place editable texts on this black board.
                      </p>
                    </div>
                  )}

                  {/* Render elements belonging to active screen */}
                  {elements
                    .filter(el => el.screen === currentScreen)
                    .map((el) => {
                      const isSelected = selectedId === el.id;
                      const isEditing = editingId === el.id;

                      return (
                        <div
                          key={el.id}
                          onPointerDown={(e) => handlePointerDown(e, el.id)}
                          className={`absolute group touch-none border border-transparent hover:border-dashed hover:border-white/30 transition-all duration-150 ${
                            isSelected ? '!border-dashed !border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.05)] z-40' : ''
                          }`}
                          style={{
                            left: `${el.x}%`,
                            top: `${el.y}%`,
                            width: el.type === 'image' ? `${el.width}px` : 'auto',
                            height: el.type === 'image' ? `${el.height}px` : 'auto',
                            minWidth: el.type === 'text' ? `${el.width}px` : 'none',
                            minHeight: el.type === 'text' ? `${el.height}px` : 'none',
                            zIndex: el.zIndex,
                          }}
                          id={`element-${el.id}`}
                        >
                          {/* Element Actions Bar (shows when selected or hovered) */}
                          {isSelected && (
                            <div className="no-drag absolute -top-10 right-0 z-50 flex items-center gap-1.5 rounded-full border border-white/20 bg-black px-2.5 py-1 shadow-lg pointer-events-auto" id={`actions-${el.id}`}>
                              {el.type === 'text' && (
                                <button
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={() => setEditingId(isEditing ? null : el.id)}
                                  className="text-[10px] uppercase font-sans text-zinc-400 hover:text-white px-1.5"
                                  title="Toggle Edit"
                                >
                                  {isEditing ? 'Done' : 'Edit'}
                                </button>
                              )}
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => handleDeleteElement(el.id, e)}
                                className="rounded-full text-zinc-400 hover:text-red-400 p-0.5"
                                title="Delete Element"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          {/* Render IMAGE block */}
                          {el.type === 'image' && (
                            <div className="relative w-full h-full overflow-hidden bg-transparent flex items-center justify-center" id={`img-wrapper-${el.id}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={el.content}
                                alt="Board upload"
                                className="w-full h-full object-contain pointer-events-none"
                                draggable={false}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}

                          {/* Render TEXT block */}
                          {el.type === 'text' && (
                            <div 
                              className={`relative p-2.5 rounded text-white ${
                                isEditing ? 'bg-black border border-white/20' : 'bg-transparent'
                              }`}
                              style={{
                                width: '100%',
                                height: '100%',
                              }}
                              onDoubleClick={() => {
                                setSelectedId(el.id);
                                setEditingId(el.id);
                              }}
                              id={`text-wrapper-${el.id}`}
                            >
                              {isEditing ? (
                                <textarea
                                  ref={(ref) => {
                                    textInputRefs.current[el.id] = ref;
                                  }}
                                  value={el.content}
                                  onChange={(e) => updateElement(el.id, { content: e.target.value })}
                                  onBlur={() => setEditingId(null)}
                                  className="w-full h-full min-h-[40px] bg-transparent text-white outline-none border-none resize-none overflow-hidden text-center focus:ring-0 p-0 font-sans"
                                  style={{ fontSize: `${el.fontSize}px`, lineHeight: 1.2 }}
                                  placeholder="Type here..."
                                  onKeyDown={(e) => {
                                    // Exit editing on Escape
                                    if (e.key === 'Escape') {
                                      setEditingId(null);
                                    }
                                  }}
                                />
                              ) : (
                                <p 
                                  className="w-full h-full text-center whitespace-pre-wrap select-none break-words font-sans font-light tracking-wide"
                                  style={{ fontSize: `${el.fontSize}px`, lineHeight: 1.2 }}
                                >
                                  {el.content || 'Click to edit'}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Draggable Indicator Corner Icons (only when selected) */}
                          {isSelected && (
                            <>
                              {/* Drag/Move indicator in top left */}
                              <div className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 rounded-full border border-white bg-black flex items-center justify-center text-[8px] text-white pointer-events-none" id={`drag-indicator-${el.id}`}>
                                <Move className="h-2 w-2" />
                              </div>

                              {/* Resize Drag-Handle in bottom-right corner */}
                              <div
                                onPointerDown={(e) => handleResizePointerDown(e, el.id)}
                                className="no-drag absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-full border border-white bg-black flex items-center justify-center cursor-se-resize shadow-md hover:bg-zinc-900 pointer-events-auto"
                                title="Drag to Resize"
                                id={`resize-handle-${el.id}`}
                              >
                                <Maximize2 className="h-2.5 w-2.5 text-white" />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* --- BOTTOM FLOATING NAVIGATION BAR / FOOTER --- */}
            <div className="pointer-events-none absolute bottom-10 right-10 z-50 flex items-center gap-6" id="bottom-navigation-wrapper">
              {/* Screen indicator label on the left */}
              <span className="text-[10px] text-zinc-500 tracking-[0.25em] uppercase select-none font-sans" id="info-status">
                SCREEN {currentScreen} / 2 • {elements.filter(el => el.screen === currentScreen).length} ITEMS
              </span>

              {currentScreen === 1 ? (
                <button
                  onClick={() => {
                    setCurrentScreen(2);
                    setSelectedId(null);
                    setEditingId(null);
                  }}
                  className="pointer-events-auto flex h-[60px] w-[60px] items-center justify-center rounded-full border border-white bg-transparent text-white hover:bg-white hover:text-black transition-all duration-300 active:scale-95 cursor-pointer"
                  id="btn-next-screen"
                  title="Go to Screen 2"
                >
                  <ArrowRight className="h-6 w-6" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCurrentScreen(1);
                    setSelectedId(null);
                    setEditingId(null);
                  }}
                  className="pointer-events-auto flex h-[60px] w-[60px] items-center justify-center rounded-full border border-white bg-transparent text-white hover:bg-white hover:text-black transition-all duration-300 active:scale-95 cursor-pointer"
                  id="btn-prev-screen"
                  title="Go to Screen 1"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Subtle Instructions Banner (dissolves after adding items) */}
            {elements.length > 0 && showHelp && (
              <div className="absolute bottom-10 left-10 z-40 flex justify-start pointer-events-none animate-fade-in" id="instructions-container">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-[10px] text-zinc-500 font-sans tracking-wide uppercase shadow-xl">
                  <span>✨ Tips: Drag to move • Bottom-right to resize • Double-click text to edit</span>
                  <button 
                    onClick={() => setShowHelp(false)} 
                    className="pointer-events-auto text-zinc-400 hover:text-white ml-2 uppercase font-semibold text-[9px] tracking-wider"
                  >
                    Hide
                  </button>
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
