import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Eye, EyeOff, LayoutGrid, SlidersHorizontal, Image as ImageIcon, Sliders } from 'lucide-react';

interface SpriteFrame {
  id: string;
  imgDataUrl: string;
  originalW: number;
  originalH: number;
  name: string;
  offsetX: number;
  offsetY: number;
  hidden: boolean;
}

// --- 现代化 UI 基础组件 ---
interface ButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'success';
  disabled?: boolean;
}
const Button = ({ onClick, children, className = "", variant = "secondary", ...props }: ButtonProps) => {
  const baseStyle = "font-semibold px-4 py-2 text-sm rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/10",
    secondary: "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 shadow-sm",
    success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/10"
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
    {children}
  </label>
);

interface InputProps {
  type?: string;
  value?: string | number;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  className?: string;
  min?: string | number;
  max?: string | number;
}
const Input = ({ type = "text", value, onChange, className = "", ...props }: InputProps) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    className={`w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all ${className}`}
    {...props}
  />
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-bold text-slate-300 mb-3.5 flex items-center gap-2">
    <div className="w-1 h-3.5 bg-blue-500 rounded-full"></div>
    {children}
  </h3>
);

interface SpriteToolProps {
  onBack: () => void;
  downloadPath?: string;
}

export default function SpriteTool({ onBack, downloadPath = 'D:\\Download' }: SpriteToolProps) {
  // --- 状态 ---
  const [frames, setFrames] = useState<SpriteFrame[]>([]); // { id, imgDataUrl, originalW, originalH, name, offsetX, offsetY, hidden }
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null); 
  const [activeTab, setActiveTab] = useState<'canvas' | 'tune' | 'gif'>('canvas');
  
  // 画布设置
  const [cols, setCols] = useState(6);
  const [rows, setRows] = useState(5);
  const [previewFrameW, setPreviewFrameW] = useState(64);
  const [previewFrameH, setPreviewFrameH] = useState(64);
  const [frameW, setFrameW] = useState(64);
  const [frameH, setFrameH] = useState(64);
  const [exportName, setExportName] = useState('sprite_export');
  const [exportWithGrid, setExportWithGrid] = useState(false); 
  
  // 视图状态
  const [showGrid, setShowGrid] = useState(false);
  const [tuneCurrentId, setTuneCurrentId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Refs
  const importSheetRef = useRef<HTMLInputElement>(null);
  const importMultiRef = useRef<HTMLInputElement>(null);

  // --- 派生状态 ---
  const visibleFrames = frames.filter(f => !f.hidden);
  const activeTuneIndex = visibleFrames.findIndex(f => f.id === tuneCurrentId);
  const activeTuneFrame = visibleFrames[activeTuneIndex];

  // 动态计算去除隐藏帧后的实际行列数 (收紧画布)
  const actualCols = visibleFrames.length > 0 ? Math.min(cols, visibleFrames.length) : cols;
  const actualRows = visibleFrames.length > 0 ? Math.ceil(visibleFrames.length / cols) : rows;

  // 棋盘格背景样式
  const checkerStyle: React.CSSProperties = {
    backgroundImage: 'conic-gradient(#1e293b 90deg, #0f172a 90deg 180deg, #1e293b 180deg 270deg, #0f172a 270deg)',
    backgroundSize: '12px 12px'
  };

  // 保持微调选中状态与列表同步
  useEffect(() => {
    if (activeTab === 'tune') {
      if (selectedIds.length > 0 && visibleFrames.some(f => f.id === selectedIds[0]) && !selectedIds.includes(tuneCurrentId || '')) {
        setTuneCurrentId(selectedIds[0]);
      } else if (activeTuneIndex === -1 && visibleFrames.length > 0) {
        setTuneCurrentId(visibleFrames[0].id);
      }
    }
  }, [activeTab, selectedIds, visibleFrames, tuneCurrentId, activeTuneIndex]);

  // --- 操作：导入 ---
  const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });

  const handleImportSpriteSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const baseFileName = file.name.replace(/\.[^/.]+$/, "");

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!event.target?.result) return;
      const img = await loadImage(event.target.result as string);
      
      const fw = Math.floor(img.width / cols);
      const fh = Math.floor(img.height / rows);
      
      setPreviewFrameW(fw);
      setPreviewFrameH(fh);
      setFrameW(fw);
      setFrameH(fh);

      const newFrames: SpriteFrame[] = [];
      const canvas = document.createElement('canvas');
      canvas.width = fw;
      canvas.height = fh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let frameCount = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, fw, fh);
          ctx.drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh);
          newFrames.push({
            id: `frame_${Date.now()}_${frameCount}`,
            imgDataUrl: canvas.toDataURL('image/png'),
            originalW: fw,
            originalH: fh,
            name: `${baseFileName}_${frameCount}`,
            offsetX: 0,
            offsetY: 0,
            hidden: false
          });
          frameCount++;
        }
      }
      setFrames(newFrames);
      setSelectedIds([]);
      setLastClickedId(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImportMultiFrames = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = (Array.from(e.target.files) as File[]).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    if (!files.length) return;

    const newFrames: SpriteFrame[] = [];
    let maxW = 0, maxH = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      const img = await loadImage(dataUrl);
      maxW = Math.max(maxW, img.width);
      maxH = Math.max(maxH, img.height);

      newFrames.push({
        id: `frame_${Date.now()}_${i}`,
        imgDataUrl: dataUrl,
        originalW: img.width,
        originalH: img.height,
        name: file.name.replace(/\.[^/.]+$/, "") || `Frame ${i}`,
        offsetX: 0,
        offsetY: 0,
        hidden: false
      });
    }

    setFrames(prev => [...prev, ...newFrames]);
    
    if (frames.length === 0) {
        setPreviewFrameW(maxW || 64);
        setPreviewFrameH(maxH || 64);
        setFrameW(maxW || 64);
        setFrameH(maxH || 64);
    }
    e.target.value = '';
  };

  // --- 操作：列表交互与多选 ---
  const handleFrameClick = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey && lastClickedId) {
      const startIdx = frames.findIndex(f => f.id === lastClickedId);
      const endIdx = frames.findIndex(f => f.id === id);

      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const newSelectedIds = frames.slice(minIdx, maxIdx + 1).map(f => f.id);

        if (e.altKey) {
            setSelectedIds(prev => Array.from(new Set([...prev, ...newSelectedIds])));
        } else {
            setSelectedIds(newSelectedIds);
        }
      } else {
        setSelectedIds([id]);
      }
    } else if (e.altKey) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
    
    setLastClickedId(id);

    if (activeTab === 'tune') {
        setTuneCurrentId(id);
    }
  };

  const toggleVisibility = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    if (selectedIds.includes(id) && selectedIds.length > 1) {
      const targetFrame = frames.find(f => f.id === id);
      if (!targetFrame) return;
      const newHiddenState = !targetFrame.hidden; 
      
      setFrames(prev => prev.map(f => 
        selectedIds.includes(f.id) ? { ...f, hidden: newHiddenState } : f
      ));
    } else {
      setFrames(prev => prev.map(f => f.id === id ? { ...f, hidden: !f.hidden } : f));
    }
  };

  // --- 操作：拖拽 ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newFrames = [...frames];
    const draggedFrame = newFrames[draggedIndex];
    newFrames.splice(draggedIndex, 1);
    newFrames.splice(dropIndex, 0, draggedFrame);
    
    setFrames(newFrames);
    setDraggedIndex(null);
  };

  // --- 操作：导出 ---
  const drawFrameToCanvas = async (ctx: CanvasRenderingContext2D, frame: SpriteFrame, fW: number, fH: number, targetX = 0, targetY = 0) => {
      const img = await loadImage(frame.imgDataUrl);
      const centerX = targetX + fW / 2;
      const centerY = targetY + fH / 2;
      const drawX = centerX - frame.originalW / 2 - frame.offsetX;
      const drawY = centerY - frame.originalH / 2 - frame.offsetY;
      ctx.drawImage(img, drawX, drawY, frame.originalW, frame.originalH);
  };

  const triggerDownloadBlob = (blob: Blob | null, filename: string) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanPath = downloadPath.replace(/[\\/]+/g, '_').replace(/:/g, '');
      link.download = `${cleanPath}_${filename}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleExportSheet = async () => {
    if (visibleFrames.length === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = actualCols * frameW;
    canvas.height = actualRows * frameH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let i = 0; i < visibleFrames.length; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        await drawFrameToCanvas(ctx, visibleFrames[i], frameW, frameH, c * frameW, r * frameH);
    }

    if (exportWithGrid) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1;
      for (let c = 1; c <= actualCols; c++) {
          ctx.beginPath(); ctx.moveTo(c * frameW, 0); ctx.lineTo(c * frameW, canvas.height); ctx.stroke();
      }
      for (let r = 1; r <= actualRows; r++) {
          ctx.beginPath(); ctx.moveTo(0, r * frameH); ctx.lineTo(canvas.width, r * frameH); ctx.stroke();
      }
    }

    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
          alert("导出失败：图集尺寸过大，超出了当前浏览器的最大限制。");
          return;
      }
      triggerDownloadBlob(blob, `${exportName}.png`);
    }, 'image/png');
  };

  const handleExportMulti = async () => {
      if (visibleFrames.length === 0) return;
      for (let i = 0; i < visibleFrames.length; i++) {
          const canvas = document.createElement('canvas');
          canvas.width = frameW;
          canvas.height = frameH;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await drawFrameToCanvas(ctx, visibleFrames[i], frameW, frameH, 0, 0);
          
          await new Promise<void>(resolve => {
              canvas.toBlob((blob: Blob | null) => {
                  triggerDownloadBlob(blob, `${exportName}_${i}.png`);
                  resolve();
              }, 'image/png');
          });
          await new Promise(res => setTimeout(res, 50));
      }
  };

  // --- 操作：微调视图切换 ---
  const handleTuneNext = () => {
      if (visibleFrames.length === 0 || activeTuneIndex < 0) return;
      
      const r = Math.floor(activeTuneIndex / cols);
      const c = activeTuneIndex % cols;
      let nextC = c + 1;
      let targetIdx = r * cols + nextC;
      
      if (nextC >= cols || targetIdx >= visibleFrames.length) {
          targetIdx = r * cols; 
      }
      
      if (visibleFrames[targetIdx]) {
          setTuneCurrentId(visibleFrames[targetIdx].id);
          setSelectedIds([visibleFrames[targetIdx].id]); 
          setLastClickedId(visibleFrames[targetIdx].id); 
      }
  };

  const handleTunePrev = () => {
      if (visibleFrames.length === 0 || activeTuneIndex < 0) return;
      
      const r = Math.floor(activeTuneIndex / cols);
      const c = activeTuneIndex % cols;
      let prevC = c - 1;
      let targetIdx = r * cols + prevC;
      
      if (prevC < 0) {
          let endOfRowIdx = r * cols + cols - 1; 
          targetIdx = endOfRowIdx < visibleFrames.length ? endOfRowIdx : visibleFrames.length - 1;
      }
      
      if (visibleFrames[targetIdx]) {
          setTuneCurrentId(visibleFrames[targetIdx].id);
          setSelectedIds([visibleFrames[targetIdx].id]); 
          setLastClickedId(visibleFrames[targetIdx].id);
      }
  };

  const updateActiveFrameOffset = (axis: 'offsetX' | 'offsetY', value: string) => {
      if (!activeTuneFrame) return;
      setFrames(prev => prev.map(f => 
          f.id === activeTuneFrame.id ? { ...f, [axis]: parseInt(value) || 0 } : f
      ));
  };

  // --- 副作用支持：快捷键 (调帧模式专用) ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (activeTab !== 'tune') return;
          if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault(); 
              handleTunePrev();
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault(); 
              handleTuneNext();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, visibleFrames, activeTuneIndex, cols]);


  // --- 渲染子组件：画布视图 ---
  const CanvasRenderer = () => {
    const cw = actualCols * previewFrameW;
    const ch = actualRows * previewFrameH;

    const handleCanvasClick = (e: React.MouseEvent, idx: number) => {
        e.stopPropagation();
        if (idx >= 0 && idx < visibleFrames.length) {
            handleFrameClick(e, visibleFrames[idx].id);
        }
    };

    return (
        <div className="w-full h-full overflow-auto bg-slate-950">
            <div className="min-w-full min-h-full flex items-center justify-center p-8">
                <div 
                    className="relative shadow-2xl bg-slate-900 border border-slate-800 rounded overflow-hidden shrink-0" 
                    style={{ width: cw, height: ch, ...checkerStyle }}
                    onClick={(e) => { 
                        if (!e.altKey && !e.shiftKey) setSelectedIds([]); 
                    }}
                >
                    {showGrid && (
                        <div className="absolute inset-0 pointer-events-none z-20" style={{
                            backgroundImage: `
                                linear-gradient(to right, rgba(239, 68, 68, 0.4) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(239, 68, 68, 0.4) 1px, transparent 1px)
                            `,
                            backgroundSize: `${previewFrameW}px ${previewFrameH}px`
                        }}></div>
                    )}

                    {visibleFrames.map((f, i) => {
                        const c = i % cols;
                        const r = Math.floor(i / cols);
                        if (c >= actualCols || r >= actualRows) return null; 
                        
                        const isSelected = selectedIds.includes(f.id);

                        return (
                            <div
                                key={f.id}
                                className={`absolute cursor-pointer overflow-hidden ${isSelected ? 'bg-blue-500/15 shadow-[inset_0_0_0_2px_#3b82f6] z-10' : 'hover:bg-slate-800/30'}`}
                                style={{
                                    left: c * previewFrameW,
                                    top: r * previewFrameH,
                                    width: previewFrameW,
                                    height: previewFrameH
                                }}
                                onClick={(e) => handleCanvasClick(e, i)}
                            >
                                <img 
                                    src={f.imgDataUrl}
                                    draggable={false}
                                    className="absolute max-w-none"
                                    style={{
                                        left: previewFrameW / 2 - f.originalW / 2 - f.offsetX,
                                        top: previewFrameH / 2 - f.originalH / 2 - f.offsetY,
                                        width: f.originalW,
                                        height: f.originalH,
                                        pointerEvents: 'none'
                                    }}
                                    alt={f.name}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
  };

  // --- 渲染子组件：调帧视图 ---
  const TuneRenderer = () => {
      if (!activeTuneFrame) return <div className="flex-1 flex items-center justify-center text-slate-500 font-medium bg-slate-950">请先在左侧队列中选择一帧进行微调</div>;

      return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-6">
              <div className="mb-6 px-4 py-1.5 bg-slate-900 border border-slate-800 shadow-lg rounded-full text-xs font-bold text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>当前微调帧: {activeTuneFrame.name}</span>
                <span className="text-[10px] text-slate-500 border-l border-slate-800 pl-2 ml-1 hidden sm:inline-block">可按方向键盘 ← ↑ ↓ → 进行切帧</span>
              </div>
              
              <div style={{ transform: 'scale(3)', transformOrigin: 'center', width: previewFrameW, height: previewFrameH, ...checkerStyle }}
                   className="relative shadow-2xl rounded border border-slate-800 overflow-hidden shrink-0">
                  
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                      <div className="w-full h-px border-t border-dashed border-red-500/40"></div>
                      <div className="absolute h-full w-px border-l border-dashed border-red-500/40"></div>
                  </div>

                  <img 
                      src={activeTuneFrame.imgDataUrl}
                      draggable={false}
                      className="absolute max-w-none"
                      style={{
                          left: previewFrameW / 2 - activeTuneFrame.originalW / 2 - activeTuneFrame.offsetX,
                          top: previewFrameH / 2 - activeTuneFrame.originalH / 2 - activeTuneFrame.offsetY,
                          width: activeTuneFrame.originalW,
                          height: activeTuneFrame.originalH
                      }}
                      alt={activeTuneFrame.name}
                  />
              </div>
          </div>
      );
  };

  // --- 渲染子组件：GIF视图 ---
  interface GifPreviewRowProps {
    rowFrames: SpriteFrame[];
    width: number;
    height: number;
  }
  const GifPreviewRow = ({ rowFrames, width, height }: GifPreviewRowProps) => {
      const [idx, setIdx] = useState(0);

      useEffect(() => {
          if (!rowFrames || rowFrames.length === 0) return;
          const timer = setInterval(() => {
              setIdx(prev => (prev + 1) % rowFrames.length);
          }, 150);
          return () => clearInterval(timer);
      }, [rowFrames]);

      const frame = rowFrames[idx];

      return (
          <div className="bg-slate-900 border border-slate-800/80 shadow-2xl rounded-2xl p-4 m-3 flex flex-col items-center hover:border-slate-700 transition-all">
              <div className="relative rounded overflow-hidden mb-3 border border-slate-950" style={{ width, height, ...checkerStyle }}>
                  {frame && (
                      <img 
                          src={frame.imgDataUrl}
                          draggable={false}
                          className="absolute max-w-none"
                          style={{
                              left: width / 2 - frame.originalW / 2 - frame.offsetX,
                              top: height / 2 - frame.originalH / 2 - frame.offsetY,
                              width: frame.originalW,
                              height: frame.originalH
                          }}
                          alt=""
                      />
                  )}
              </div>
              <span className="font-bold text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800/60">
                Play • {idx + 1}/{rowFrames.length}
              </span>
          </div>
      );
  };

  const GifRenderer = () => {
      const rowGroups: SpriteFrame[][] = [];
      for (let i = 0; i < visibleFrames.length; i += cols) {
          rowGroups.push(visibleFrames.slice(i, i + cols));
      }

      if (visibleFrames.length === 0) return <div className="flex-1 flex items-center justify-center text-slate-500 font-medium bg-slate-950">暂无可见动画序列帧</div>;

      return (
          <div className="w-full h-full overflow-auto flex flex-wrap content-start p-6 bg-slate-950">
              {rowGroups.map((group, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="font-bold text-[10px] text-slate-400 mb-[-12px] z-10 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full shadow-md">
                        Row {i+1} Loop
                    </div>
                    <GifPreviewRow rowFrames={group} width={previewFrameW} height={previewFrameH} />
                  </div>
              ))}
          </div>
      );
  };

  // --- 主体渲染 ---
  return (
    <div className="w-full h-screen flex flex-col font-sans text-slate-300 bg-slate-950 overflow-hidden md:flex-row">
      
      {/* 左侧：帧列表 */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0 z-10">
        
        {/* 返回工坊与标签 */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回创意工坊</span>
          </button>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
            Sprite Tuner
          </span>
        </div>

        <div className="p-4 border-b border-slate-100/5 flex justify-between items-center bg-slate-950/20 shrink-0">
          <span className="font-bold text-xs">序列帧列表</span>
          <span className="bg-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-700/60">{frames.length} 帧</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[220px] md:max-h-none">
          {frames.map((frame, index) => {
            const isSelected = selectedIds.includes(frame.id);
            const isHidden = frame.hidden;
            return (
              <div 
                key={frame.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e, index)}
                onClick={(e) => handleFrameClick(e, frame.id)}
                className={`flex items-center p-2 rounded-xl cursor-pointer transition-all border
                  ${isSelected 
                      ? 'bg-blue-600/15 border-blue-500/50 shadow-inner' 
                      : 'hover:bg-slate-800/50 border-transparent'}
                  ${isHidden ? 'opacity-40 grayscale' : ''}
                `}
              >
                {/* 隐藏/显示切换 */}
                <button 
                    onClick={(e) => toggleVisibility(e, frame.id)} 
                    className={`p-1 rounded-md transition-colors ${isHidden ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'} cursor-pointer`}
                    title={isHidden ? "显示当前帧" : "隐藏当前帧"}
                >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                </button>

                <div className={`font-mono text-[10px] font-bold w-4 text-center ml-1 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`}>
                    {index + 1}
                </div>
                
                <div className="w-9 h-9 ml-2 rounded-lg border border-slate-950 shrink-0 bg-slate-900"
                     style={{
                         ...checkerStyle,
                         backgroundImage: `url(${frame.imgDataUrl}), ${checkerStyle.backgroundImage}`,
                         backgroundSize: 'contain, 6px 6px',
                         backgroundPosition: 'center',
                         backgroundRepeat: 'no-repeat, repeat'
                     }}
                ></div>
                <div className={`ml-2.5 font-medium text-xs truncate flex-1 ${isSelected ? 'text-white' : 'text-slate-400'} ${isHidden ? 'line-through text-slate-600' : ''}`} title={frame.name}>
                    {frame.name}
                </div>
              </div>
            );
          })}
          {frames.length === 0 && (
              <div className="py-10 flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-2xl">
                  <ImageIcon className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-semibold">暂无图像序列</p>
              </div>
          )}
        </div>
      </aside>

      {/* 中间：主预览区 */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-slate-950">
        
        <div className="flex-1 relative overflow-hidden flex flex-col">
            {activeTab === 'canvas' && <CanvasRenderer />}
            {activeTab === 'tune' && <TuneRenderer />}
            {activeTab === 'gif' && <GifRenderer />}
        </div>

        {activeTab === 'canvas' && (
            <div className="absolute bottom-16 right-4 z-10">
                <label className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl rounded-full cursor-pointer hover:bg-slate-900 transition-all select-none">
                    <input 
                        type="checkbox" 
                        checked={showGrid} 
                        onChange={(e) => setShowGrid(e.target.checked)} 
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer border-slate-700 bg-slate-950"
                    />
                    <span className="font-bold text-xs text-slate-300">显示切片网格线</span>
                </label>
            </div>
        )}

        {activeTab === 'tune' && visibleFrames.length > 0 && (
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex gap-3 z-10 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-full shadow-2xl border border-slate-800">
                <Button onClick={handleTunePrev} className="px-5 py-1.5 rounded-full hover:shadow-lg text-xs">← Prev Frame</Button>
                <Button onClick={handleTuneNext} className="px-5 py-1.5 rounded-full hover:shadow-lg text-xs">Next Frame →</Button>
            </div>
        )}

        {/* 底部视图页签 */}
        <div className="h-12 bg-slate-900 border-t border-slate-800/80 flex justify-center items-center gap-1.5 px-6 shrink-0">
          {[
            { id: 'canvas' as const, label: '大图画布' },
            { id: 'tune' as const, label: '精细调帧' },
            { id: 'gif' as const, label: 'GIF 循环预览' }
          ].map(tab => (
             <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-1.5 rounded-lg font-bold text-xs transition-all duration-200 cursor-pointer ${
                    activeTab === tab.id 
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
            >
                {tab.label}
             </button>
          ))}
        </div>
      </main>

      {/* 右侧：详细参数面板 */}
      <aside className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shrink-0">
         <div className="p-4 border-b border-slate-800 font-bold text-sm text-slate-300">
             排版与精调参数
         </div>
         
         <div className="flex-1 overflow-y-auto p-5 space-y-5">
             
             <div className="bg-slate-950/40 p-4.5 rounded-2xl border border-slate-800 shadow-inner">
                 <SectionTitle>网格重组配置</SectionTitle>
                 
                 <div className="grid grid-cols-2 gap-3 mb-4">
                     <div>
                         <Label>大图列数 (Cols)</Label>
                         <Input type="number" min="1" max="100" value={cols} onChange={e => setCols(parseInt(e.target.value) || 1)} />
                     </div>
                     <div>
                         <Label>大图行数 (Rows)</Label>
                         <Input type="number" min="1" max="100" value={rows} onChange={e => setRows(parseInt(e.target.value) || 1)} />
                     </div>
                 </div>

                 <div className="mb-4 bg-blue-500/5 border border-blue-500/10 text-slate-400 px-3 py-2.5 rounded-xl space-y-1.5 text-[11px] font-semibold">
                     <div className="w-full flex justify-between text-slate-500">
                         <span>初始拼版设定</span>
                         <span className="font-mono text-slate-400">{cols * previewFrameW} × {rows * previewFrameH} px</span>
                     </div>
                     <div className="w-full flex justify-between font-bold text-slate-300 border-t border-slate-800/80 pt-1.5">
                         <span>排版去除隐藏帧尺寸</span>
                         <span className="font-mono text-blue-400">{actualCols * previewFrameW} × {actualRows * previewFrameH} px</span>
                     </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 mb-4">
                     <div>
                         <Label>切片宽度 (px)</Label>
                         <Input type="number" min="1" value={previewFrameW} onChange={e => setPreviewFrameW(parseInt(e.target.value) || 1)} />
                     </div>
                     <div>
                         <Label>切片高度 (px)</Label>
                         <Input type="number" min="1" value={previewFrameH} onChange={e => setPreviewFrameH(parseInt(e.target.value) || 1)} />
                     </div>
                 </div>

                 <Button 
                      variant="primary"
                      onClick={() => { setFrameW(previewFrameW); setFrameH(previewFrameH); }}
                      className="w-full mb-5 py-2 text-xs"
                 >
                      重组并应用画布设置
                 </Button>

                 <div className="pt-4 border-t border-slate-800/60">
                     <Label>输出文件名</Label>
                     <Input value={exportName} onChange={e => setExportName(e.target.value)} className="mb-3" />
                      
                      <div className="mb-3.5 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span>下载路径:</span>
                          <span className="font-mono text-slate-400 break-all max-w-[150px] text-right" title={downloadPath}>{downloadPath}</span>
                      </div>
                     
                     <label className="flex items-center gap-2 cursor-pointer group w-fit select-none">
                         <input 
                             type="checkbox" 
                             checked={exportWithGrid} 
                             onChange={(e) => setExportWithGrid(e.target.checked)} 
                             className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer border-slate-800 bg-slate-950"
                         />
                         <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-300 transition-colors">
                             导出图集包含红色分界线
                         </span>
                     </label>
                 </div>
             </div>

             {activeTab === 'tune' && activeTuneFrame && (
                 <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <SectionTitle>选中个体帧偏移微调</SectionTitle>
                     <div className="flex items-center gap-2 mb-3.5">
                         <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                         <span className="text-xs font-bold text-indigo-300 truncate max-w-[200px]">{activeTuneFrame.name}</span>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-3">
                         <div>
                             <Label>X 轴位移 (px)</Label>
                             <Input type="number" value={activeTuneFrame.offsetX} onChange={e => updateActiveFrameOffset('offsetX', e.target.value)} />
                         </div>
                         <div>
                             <Label>Y 轴位移 (px)</Label>
                             <Input type="number" value={activeTuneFrame.offsetY} onChange={e => updateActiveFrameOffset('offsetY', e.target.value)} />
                         </div>
                     </div>
                     
                     <div className="mt-3.5 flex items-start gap-2 bg-indigo-950/20 p-2.5 rounded-lg text-[10px] text-indigo-300/80 leading-relaxed border border-indigo-500/5">
                         <p>微调 X/Y 位移能够改变图像在该切片内的绘制锚点位置，修正动画过程中的骨骼抖动。</p>
                     </div>
                 </div>
             )}
         </div>

         {/* 侧栏底部：导入与导出 */}
         <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex flex-col gap-2 shrink-0">
             <div className="flex gap-2">
                 <input type="file" accept="image/*" ref={importSheetRef} onChange={handleImportSpriteSheet} className="hidden" />
                 <Button onClick={() => importSheetRef.current?.click()} variant="primary" className="flex-1 py-2 text-xs">导入图集并拆分</Button>
                 
                 <input type="file" accept="image/*" multiple ref={importMultiRef} onChange={handleImportMultiFrames} className="hidden" />
                 <Button onClick={() => importMultiRef.current?.click()} className="flex-1 py-2 text-xs">导入多帧组合</Button>
             </div>
             <div className="flex gap-2">
                 <Button onClick={handleExportSheet} variant="success" className="flex-1 py-2 text-xs">导出重组图集</Button>
                 <Button onClick={handleExportMulti} className="flex-1 py-2 text-xs">导出多帧切片</Button>
             </div>
         </div>

      </aside>

    </div>
  );
}
