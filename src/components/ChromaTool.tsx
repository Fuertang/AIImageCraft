import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Image as ImageIcon, X, Palette, Scissors, Pipette, Lock, Unlock, Check, ArrowLeft } from 'lucide-react';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  img: HTMLImageElement;
  name: string;
  width: number;
  height: number;
}

interface DragState {
  handle: string;
  startX: number;
  startY: number;
  startCrop: { x: number; y: number; w: number; h: number };
}

// --- 工具函数：颜色与距离计算 ---
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// 核心处理函数：应用绿幕抠除
const applyChromaToCtx = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colorHex: string,
  tolerancePercent: number
) => {
  if (!colorHex || tolerancePercent === 0) return;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const rgb = hexToRgb(colorHex);
  if (!rgb) return;
  
  // 最大欧几里得距离的平方 (255^2 * 3 = 195075)
  // 将 0-100 的百分比映射到这个范围内
  const t = tolerancePercent / 100;
  const tolSq = t * t * 195075;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const distSq = (r - rgb.r)**2 + (g - rgb.g)**2 + (b - rgb.b)**2;
    if (distSq <= tolSq) {
      data[i+3] = 0; // 将相似颜色设为透明
    }
  }
  ctx.putImageData(imgData, 0, 0);
};

interface ChromaToolProps {
  onBack: () => void;
  downloadPath?: string;
}

export default function ChromaTool({ onBack, downloadPath = 'D:\\Download' }: ChromaToolProps) {
  // --- 状态管理 ---
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'chroma' | 'crop' | 'export'>('chroma');
  
  // 功能状态
  const [chromaConfig, setChromaConfig] = useState({ enabled: true, color: '#00FF00', tolerance: 20 });
  const [cropConfig, setCropConfig] = useState({ x: 0, y: 0, w: 0, h: 0 }); // 当前交互中的裁剪框
  const [appliedCrop, setAppliedCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null); // 已锁定的裁剪范围
  const [exportConfig, setExportConfig] = useState({ w: 0, h: 0, lockRatio: true });
  const [isExporting, setIsExporting] = useState(false);

  // 引用与画布尺寸管理
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);

  const currentImage = images[selectedIndex];

  // 监听容器大小改变，用于自适应画布
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setContainerSize({ w: entries[0].contentRect.width, h: entries[0].contentRect.height });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- 处理文件上传 ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = (Array.from(e.target.files) as File[]).filter(file => file.type.startsWith('image/'));
    let loadedCount = 0;
    const newImages: ImageItem[] = [];

    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        newImages.push({
          id: Math.random().toString(36).substring(7),
          file,
          url,
          img,
          name: file.name,
          width: img.width,
          height: img.height
        });
        loadedCount++;
        if (loadedCount === files.length) {
          setImages(prev => {
            const combined = [...prev, ...newImages];
            // 如果是首次上传，初始化选框和导出尺寸为第一张图片的原始尺寸
            if (prev.length === 0 && newImages.length > 0) {
              const first = newImages[0];
              const initCrop = { x: 0, y: 0, w: first.width, h: first.height };
              setCropConfig(initCrop);
              setAppliedCrop(initCrop);
              setExportConfig({ w: first.width, h: first.height, lockRatio: true });
            }
            return combined;
          });
        }
      };
      img.src = url;
    });
  };

  // --- 画布渲染逻辑 ---
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentImage) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 在“导出”页签中，直接预览裁剪后的最终结果
    if (activeTab === 'export' && appliedCrop) {
      canvas.width = appliedCrop.w;
      canvas.height = appliedCrop.h;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(currentImage.img, appliedCrop.x, appliedCrop.y, appliedCrop.w, appliedCrop.h, 0, 0, appliedCrop.w, appliedCrop.h);
      if (chromaConfig.enabled) applyChromaToCtx(ctx, appliedCrop.w, appliedCrop.h, chromaConfig.color, chromaConfig.tolerance);
    } 
    // 在其它页签中，预览完整原图以便操作
    else {
      canvas.width = currentImage.width;
      canvas.height = currentImage.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(currentImage.img, 0, 0);
      if (chromaConfig.enabled) applyChromaToCtx(ctx, canvas.width, canvas.height, chromaConfig.color, chromaConfig.tolerance);
    }
  }, [currentImage, activeTab, appliedCrop, chromaConfig]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // --- 计算画布及覆盖层的显示比例 ---
  let canvasCSSWidth = 0;
  let canvasCSSHeight = 0;
  let renderScale = 1;

  if (currentImage && containerSize.w > 0 && containerSize.h > 0) {
    const isExportPreview = activeTab === 'export' && appliedCrop;
    const activeWidth = isExportPreview && appliedCrop ? appliedCrop.w : currentImage.width;
    const activeHeight = isExportPreview && appliedCrop ? appliedCrop.h : currentImage.height;
    
    const imgRatio = activeWidth / activeHeight;
    const contRatio = containerSize.w / containerSize.h;
    const padding = 64; // 画布外边距
    
    if (imgRatio > contRatio) {
      canvasCSSWidth = Math.max(10, containerSize.w - padding);
      canvasCSSHeight = canvasCSSWidth / imgRatio;
    } else {
      canvasCSSHeight = Math.max(10, containerSize.h - padding);
      canvasCSSWidth = canvasCSSHeight * imgRatio;
    }
    renderScale = canvasCSSWidth / activeWidth;
  }

  // --- 裁剪交互逻辑 ---
  const handleDragStart = (e: React.MouseEvent, handleType: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({ handle: handleType, startX: e.clientX, startY: e.clientY, startCrop: { ...cropConfig } });
  };

  useEffect(() => {
    if (!dragState || !currentImage) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragState.startX) / renderScale;
      const dy = (e.clientY - dragState.startY) / renderScale;
      let { x, y, w, h } = dragState.startCrop;
      const { handle } = dragState;

      if (handle === 'center') { x += dx; y += dy; }
      else {
        if (handle.includes('e')) w += dx;
        if (handle.includes('s')) h += dy;
        if (handle.includes('w')) { x += dx; w -= dx; }
        if (handle.includes('n')) { y += dy; h -= dy; }
      }

      // 强制最小尺寸和边界限制
      const minSize = 20;
      if (w < minSize) { w = minSize; if (handle.includes('w')) x = dragState.startCrop.x + dragState.startCrop.w - minSize; }
      if (h < minSize) { h = minSize; if (handle.includes('n')) y = dragState.startCrop.y + dragState.startCrop.h - minSize; }
      
      if (x < 0) { if (handle !== 'center') w += x; x = 0; }
      if (y < 0) { if (handle !== 'center') h += y; y = 0; }
      
      if (x + w > currentImage.width) {
        if (handle === 'center') x = currentImage.width - w;
        else w = currentImage.width - x;
      }
      if (y + h > currentImage.height) {
        if (handle === 'center') y = currentImage.height - h;
        else h = currentImage.height - y;
      }

      setCropConfig({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    };

    const handleMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, renderScale, currentImage]);

  // --- 吸管功能 ---
  const handleEyeDropper = async () => {
    if (!(window as any).EyeDropper) {
      alert('您的浏览器不支持吸管API，请直接点击颜色块选择。');
      return;
    }
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();
      setChromaConfig({ ...chromaConfig, color: result.sRGBHex });
    } catch (e) { /* 用户取消 */ }
  };

  // --- 导出逻辑 ---
  const handleExportBatch = async () => {
    if (images.length === 0 || !appliedCrop) return;
    setIsExporting(true);

    for (let i = 0; i < images.length; i++) {
      const imgObj = images[i];
      const canvas = document.createElement('canvas');
      canvas.width = exportConfig.w;
      canvas.height = exportConfig.h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      ctx.drawImage(imgObj.img, appliedCrop.x, appliedCrop.y, appliedCrop.w, appliedCrop.h, 0, 0, exportConfig.w, exportConfig.h);
      if (chromaConfig.enabled) {
        applyChromaToCtx(ctx, exportConfig.w, exportConfig.h, chromaConfig.color, chromaConfig.tolerance);
      }

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseFilename = `exported_${imgObj.name.replace(/\.[^/.]+$/, "")}.png`;
        const cleanPath = downloadPath.replace(/[\\/]+/g, '_').replace(/:/g, '');
        a.download = `${cleanPath}_${baseFilename}`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      // 添加短暂延迟，防止浏览器拦截批量下载
      await new Promise(r => setTimeout(r, 400));
    }
    setIsExporting(false);
  };

  const handleApplyCrop = () => {
    setAppliedCrop(cropConfig);
    // 更新导出尺寸时保持最新裁剪的宽高
    setExportConfig({ w: cropConfig.w, h: cropConfig.h, lockRatio: exportConfig.lockRatio });
  };

  const updateExportSize = (key: 'w' | 'h', val: string) => {
    if (!appliedCrop) return;
    const v = Math.max(1, parseInt(val) || 1);
    let { w, h } = exportConfig;
    const ratio = appliedCrop.w / appliedCrop.h;
    if (key === 'w') {
      w = v;
      if (exportConfig.lockRatio) h = Math.round(w / ratio);
    } else {
      h = v;
      if (exportConfig.lockRatio) w = Math.round(h * ratio);
    }
    setExportConfig({ ...exportConfig, w, h });
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden flex-col md:flex-row">
      
      {/* 极简左侧侧边栏：包含返回按钮与图片列表 */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col z-10 shrink-0">
        
        {/* 返回枢纽 */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回创意工坊</span>
          </button>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
            Chroma & Crop
          </span>
        </div>

        <div className="p-4 border-b border-slate-800">
          <label className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-2.5 px-4 rounded-xl cursor-pointer transition-all text-sm font-medium shadow-md shadow-blue-600/10">
            <Upload className="w-4 h-4" />
            <span>批量上传图片</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[240px] md:max-h-none">
          <div className="text-xs text-slate-500 px-2 pb-1 font-semibold flex justify-between">
            <span>待处理队列</span>
            <span>{images.length} 项</span>
          </div>
          {images.map((img, idx) => (
            <div 
              key={img.id} 
              onClick={() => setSelectedIndex(idx)}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${idx === selectedIndex ? 'bg-blue-600/15 border-blue-500/50 text-white' : 'hover:bg-slate-800/50 border-transparent text-slate-300'}`}
            >
              <img src={img.url} alt={img.name} className="w-10 h-10 object-cover rounded-lg bg-slate-950 border border-slate-800 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium" title={img.name}>{img.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{img.width} × {img.height}</p>
              </div>
            </div>
          ))}
          {images.length === 0 && (
            <div className="text-center text-slate-600 text-sm py-8 px-4 border border-dashed border-slate-800/80 rounded-2xl">
              暂无图片，请先上传图片进行处理
            </div>
          )}
        </div>
      </aside>

      {/* 中间：画布预览区域 */}
      <main className="flex-1 flex flex-col relative bg-slate-950" ref={containerRef}>
        <div className="flex-1 w-full h-full flex items-center justify-center p-4 checkerboard-bg relative">
          {currentImage ? (
            <div 
              className="relative shadow-2xl ring-1 ring-slate-800/50 rounded overflow-hidden"
              style={{ width: canvasCSSWidth, height: canvasCSSHeight }}
            >
              <canvas ref={canvasRef} className="w-full h-full" />
              
              {/* 裁剪交互覆盖层 */}
              {activeTab === 'crop' && (
                <div 
                  className="absolute cursor-move border border-blue-500"
                  onMouseDown={(e) => handleDragStart(e, 'center')}
                  style={{
                    left: cropConfig.x * renderScale,
                    top: cropConfig.y * renderScale,
                    width: cropConfig.w * renderScale,
                    height: cropConfig.h * renderScale,
                    boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.75)' // 周围半透明遮罩
                  }}
                >
                  {/* 九宫格参考线 */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-b border-white/20"></div>
                    <div className="border-r border-white/20"></div>
                    <div className="border-r border-white/20"></div>
                    <div></div>
                  </div>
                  {/* 控制手柄 */}
                  <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize" onMouseDown={(e) => handleDragStart(e, 'nw')} />
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-ns-resize" onMouseDown={(e) => handleDragStart(e, 'n')} />
                  <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize" onMouseDown={(e) => handleDragStart(e, 'ne')} />
                  <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-ew-resize" onMouseDown={(e) => handleDragStart(e, 'w')} />
                  <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-ew-resize" onMouseDown={(e) => handleDragStart(e, 'e')} />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize" onMouseDown={(e) => handleDragStart(e, 'sw')} />
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-ns-resize" onMouseDown={(e) => handleDragStart(e, 's')} />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize" onMouseDown={(e) => handleDragStart(e, 'se')} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 flex flex-col items-center select-none max-w-sm text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow-inner">
                <ImageIcon className="w-8 h-8 text-slate-400 opacity-60" />
              </div>
              <h4 className="font-semibold text-slate-300 mb-1.5">准备开始抠图裁剪</h4>
              <p className="text-xs text-slate-500 leading-relaxed">在左侧上传或者拖入一张或多张图片，我们将自动加载您的第一张图作为裁剪边界基准。</p>
            </div>
          )}
        </div>
      </main>

      {/* 右侧：设置面板与底部页签 */}
      <aside className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col z-10 shadow-2xl shrink-0">
        
        {/* 设置内容区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          {images.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-10">等待上传图片以配置参数...</div>
          ) : (
            <>
              {/* === 抠绿幕 面板 === */}
              {activeTab === 'chroma' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base flex items-center gap-2"><Palette className="w-4 h-4 text-green-400"/>抠除绿幕背景</h3>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={chromaConfig.enabled} 
                        onChange={(e) => setChromaConfig({...chromaConfig, enabled: e.target.checked})}
                        className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-300">启用</span>
                    </label>
                  </div>

                  <div className={`space-y-5 ${!chromaConfig.enabled && 'opacity-40 pointer-events-none transition-all'}`}>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase block">剔除颜色</label>
                      <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-slate-700 shadow-inner flex-shrink-0 bg-slate-950">
                          <input 
                            type="color" 
                            value={chromaConfig.color}
                            onChange={(e) => setChromaConfig({...chromaConfig, color: e.target.value})}
                            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                          />
                        </div>
                        <input 
                          type="text" 
                          value={chromaConfig.color.toUpperCase()} 
                          onChange={(e) => setChromaConfig({...chromaConfig, color: e.target.value})}
                          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 flex-1 font-mono text-sm uppercase text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                        />
                        <button 
                          onClick={handleEyeDropper}
                          title="吸管取色"
                          className="p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-slate-300 transition-all cursor-pointer border border-slate-800"
                        >
                          <Pipette className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-xs">
                        <label className="text-slate-400 font-bold uppercase">色彩容差度 (Similarity)</label>
                        <span className="font-mono text-blue-400 font-bold">{chromaConfig.tolerance}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={chromaConfig.tolerance}
                        onChange={(e) => setChromaConfig({...chromaConfig, tolerance: parseInt(e.target.value)})}
                        className="w-full accent-blue-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-2">控制颜色容差范围。数值越大，剔除的相近色越多。棋盘格背景部分将被输出为纯透明色。</p>
                    </div>
                  </div>
                </div>
              )}

              {/* === 裁剪 面板 === */}
              {activeTab === 'crop' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="font-bold text-base flex items-center gap-2"><Scissors className="w-4 h-4 text-amber-400"/>设置切片范围</h3>
                  
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">宽度 (W)</label>
                      <input type="number" value={cropConfig.w} onChange={(e) => setCropConfig({...cropConfig, w: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">高度 (H)</label>
                      <input type="number" value={cropConfig.h} onChange={(e) => setCropConfig({...cropConfig, h: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">X 偏移量</label>
                      <input type="number" value={cropConfig.x} onChange={(e) => setCropConfig({...cropConfig, x: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Y 偏移量</label>
                      <input type="number" value={cropConfig.y} onChange={(e) => setCropConfig({...cropConfig, y: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </div>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl text-[11px] text-amber-200/80 leading-relaxed">
                    提示：可以直接在左侧预览区中直接按住裁剪框拖拽其边缘和四个角进行快速调整。
                  </div>

                  <button 
                    onClick={handleApplyCrop}
                    className="w-full bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Check className="w-4 h-4"/>
                    锁定当前选区
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">锁定后，批处理将根据这个特定绝对区域，裁剪队列中所有图片。</p>
                </div>
              )}

              {/* === 导出 面板 === */}
              {activeTab === 'export' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="font-bold text-base flex items-center gap-2"><Download className="w-4 h-4 text-blue-400"/>批量切图导出</h3>
                  
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase">缩放输出尺寸</label>
                      <button 
                        onClick={() => setExportConfig({...exportConfig, lockRatio: !exportConfig.lockRatio})}
                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-all font-semibold ${exportConfig.lockRatio ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                      >
                        {exportConfig.lockRatio ? <Lock className="w-2.5 h-2.5"/> : <Unlock className="w-2.5 h-2.5"/>}
                        保持原始比例
                      </button>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block text-center">输出宽度 (px)</label>
                        <input 
                          type="number" value={exportConfig.w} 
                          onChange={(e) => updateExportSize('w', e.target.value)} 
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                        />
                      </div>
                      <div className="text-slate-600 mt-4"><X className="w-3.5 h-3.5"/></div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block text-center">输出高度 (px)</label>
                        <input 
                          type="number" value={exportConfig.h} 
                          onChange={(e) => updateExportSize('h', e.target.value)} 
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>待处理图片数量</span>
                      <span className="font-bold text-blue-400 font-mono">{images.length} 张</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>工作流模式</span>
                      <span className="font-semibold text-slate-200">批量裁剪与抠除</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>配置下载路径</span>
                      <span className="font-mono text-[10px] text-slate-300 break-all select-all text-right max-w-[150px]" title={downloadPath}>{downloadPath}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleExportBatch}
                    disabled={isExporting || !appliedCrop}
                    className={`w-full font-bold py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm
                      ${isExporting ? 'bg-blue-800 text-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/10'}
                      ${!appliedCrop ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {isExporting ? (
                      <span className="animate-pulse">正在处理并下载中...</span>
                    ) : (
                      <>
                        <Download className="w-4 h-4"/>
                        开始批量导出 ({images.length} 张)
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">浏览器将会自动依次弹窗并下载切图完毕后的透明 PNG 格式文件。</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部功能页签 (Tabs) */}
        <div className="flex bg-slate-950 p-2 gap-1.5 border-t border-slate-800/80 shrink-0">
          <button
            onClick={() => setActiveTab('chroma')}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider
              ${activeTab === 'chroma' ? 'bg-slate-800 text-emerald-400 border border-slate-700/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}
          >
            <Palette className="w-4 h-4" />
            抠绿幕
          </button>
          <button
            onClick={() => setActiveTab('crop')}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider
              ${activeTab === 'crop' ? 'bg-slate-800 text-amber-400 border border-slate-700/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}
          >
            <Scissors className="w-4 h-4" />
            裁剪
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider
              ${activeTab === 'export' ? 'bg-slate-800 text-blue-400 border border-slate-700/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}
          >
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </aside>

      {/* 补充：全局深色模式网格背景样式 */}
      <style dangerouslySetInnerHTML={{__html: `
        .checkerboard-bg {
          background-image: 
            linear-gradient(45deg, #1e293b 25%, transparent 25%), 
            linear-gradient(-45deg, #1e293b 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #1e293b 75%), 
            linear-gradient(-45deg, transparent 75%, #1e293b 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
          background-color: #0f172a;
        }
      `}} />
    </div>
  );
}
