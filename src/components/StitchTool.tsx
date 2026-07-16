import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Upload, FileUp, Download, Copy, RotateCw, Trash2, ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

interface StitchImage {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  rotate: number; // 0=0度, 1=-90度, 2=-180度, 3=-270度
}

interface PositionedImage extends StitchImage {
  x: number;
  y: number;
}

interface GlobalParams {
  canvasWidth: number;
  canvasHeight: number;
  gapX: number;
  gapY: number;
  dpi: number;
  unit: 'px' | 'cm';
  exportPrefix: string;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

interface StitchToolProps {
  onBack: () => void;
  downloadPath?: string;
}

export default function StitchTool({ onBack, downloadPath = 'D:\\Download' }: StitchToolProps) {
  // --- 状态管理 ---
  const [images, setImages] = useState<StitchImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoomScale, setZoomScale] = useState<number>(0.4); // 默认缩小以便完整展示画布
  const [draggedId, setDraggedId] = useState<string | null>(null);
  
  // 全局参数状态
  const [globalParams, setGlobalParams] = useState<GlobalParams>({
    canvasWidth: 1920,
    canvasHeight: 1080,
    gapX: 16,
    gapY: 16,
    dpi: 300,
    unit: 'px',
    exportPrefix: 'stitch_export'
  });

  // 预览状态
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // --- 核心逻辑：分页与布局计算 ---
  const layoutPages = useMemo(() => {
    const pages: PositionedImage[][] = [];
    let currentItems: PositionedImage[] = [];
    let currentX = 0;
    let currentY = 0;
    let currentRowHeight = 0;

    images.forEach((img) => {
      const w = img.width;
      const h = img.height;

      // 换行检测
      if (currentX + w > globalParams.canvasWidth && currentX > 0) {
        currentX = 0;
        currentY += currentRowHeight + globalParams.gapY;
        currentRowHeight = 0;
      }

      // 换页检测
      if (currentY + h > globalParams.canvasHeight) {
        if (currentItems.length > 0) {
          pages.push(currentItems);
          currentItems = [];
          currentX = 0;
          currentY = 0;
          currentRowHeight = 0;
        }
      }

      currentItems.push({ ...img, x: currentX, y: currentY });

      currentX += w + globalParams.gapX;
      currentRowHeight = Math.max(currentRowHeight, h);
    });

    if (currentItems.length > 0) {
      pages.push(currentItems);
    }
    
    // 如果没有图片，确保至少有一页空白用于预览画布
    if (pages.length === 0) {
        pages.push([]);
    }

    return pages;
  }, [images, globalParams]);

  // 当总页数改变且当前页超出范围时，修正当前页
  useEffect(() => {
    if (currentPage >= layoutPages.length && layoutPages.length > 0) {
      setCurrentPage(layoutPages.length - 1);
    }
  }, [layoutPages.length, currentPage]);

  // --- 单位换算工具 ---
  const pxToCm = (px: number) => parseFloat(((px * 2.54) / globalParams.dpi).toFixed(2));
  const cmToPx = (cm: number) => Math.round((cm * globalParams.dpi) / 2.54);

  const displayValue = (pxValue: number) => {
    return globalParams.unit === 'cm' ? pxToCm(pxValue) : pxValue;
  };

  const parseInputValue = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return 0;
    return globalParams.unit === 'cm' ? cmToPx(val) : val;
  };

  // --- 交互处理函数 ---
  const processFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const newImages: StitchImage[] = [];
    const files = Array.from(fileList).filter(f => f.type === 'image/png' || f.type === 'image/jpeg');
    
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.src = url;
      });
      
      newImages.push({
        id: generateId(),
        file: file,
        url: url,
        width: img.width,
        height: img.height,
        originalWidth: img.width,
        originalHeight: img.height,
        rotate: 0
      });
    }
    
    setImages(prev => [...prev, ...newImages]);
  };

  const handleLoadFiles = (e: React.ChangeEvent<HTMLInputElement>) => { 
    processFiles(e.target.files); 
    e.target.value = ''; 
  };
  
  const handleLoadFolder = (e: React.ChangeEvent<HTMLInputElement>) => { 
    processFiles(e.target.files); 
    e.target.value = ''; 
  };

  // 拖拽上传
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // 拖拽重排
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setImages(prev => {
      const draggedIndex = prev.findIndex(img => img.id === draggedId);
      const targetIndex = prev.findIndex(img => img.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newImages = [...prev];
      const [draggedItem] = newImages.splice(draggedIndex, 1);
      newImages.splice(targetIndex, 0, draggedItem);
      return newImages;
    });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // 选择
  const handleSelect = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey) {
      setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const selectAll = () => {
    setSelectedIds(images.map(img => img.id));
  };

  // 复制
  const copySelectedImages = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    setImages(prev => {
      const newArray = [...prev];
      const indicesToCopy = selectedIds.map(id => prev.findIndex(img => img.id === id)).sort((a, b) => b - a);
      
      indicesToCopy.forEach(index => {
        if (index === -1) return;
        const original = newArray[index];
        const copy = { ...original, id: generateId() };
        newArray.splice(index + 1, 0, copy);
      });
      return newArray;
    });
  }, [selectedIds]);

  const removeSelectedImages = () => {
    setImages(prev => prev.filter(img => !selectedIds.includes(img.id)));
    setSelectedIds([]);
  };

  const handleResize = (dimension: 'width' | 'height', valStr: string) => {
    const parsedVal = parseFloat(valStr);
    const pxVal = isNaN(parsedVal) ? 0 : (globalParams.unit === 'cm' ? cmToPx(parsedVal) : parsedVal);

    setImages(prev => prev.map(img => {
      if (selectedIds.includes(img.id)) {
        const isSwapped = img.rotate % 2 !== 0;
        const origW = isSwapped ? img.originalHeight : img.originalWidth;
        const origH = isSwapped ? img.originalWidth : img.originalHeight;
        const ratio = origW / origH;

        if (dimension === 'width') {
          return { ...img, width: pxVal, height: Math.round(pxVal / ratio) };
        } else {
          return { ...img, height: pxVal, width: Math.round(pxVal * ratio) };
        }
      }
      return img;
    }));
  };

  const handleRotateSelected = () => {
    setImages(prev => prev.map(img => {
      if (selectedIds.includes(img.id)) {
        return {
          ...img,
          width: img.height,
          height: img.width,
          rotate: (img.rotate + 1) % 4
        };
      }
      return img;
    }));
  };

  const handleSwapGlobalSize = () => {
    setGlobalParams(prev => ({
      ...prev,
      canvasWidth: prev.canvasHeight,
      canvasHeight: prev.canvasWidth
    }));
  };

  // --- 鼠标滚轮缩放 ---
  useEffect(() => {
    const previewElement = previewRef.current;
    if (!previewElement) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoomScale(p => Math.min(5, p + 0.05));
        } else if (e.deltaY > 0) {
          setZoomScale(p => Math.max(0.1, p - 0.05));
        }
      }
    };

    previewElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => previewElement.removeEventListener('wheel', handleWheel);
  }, []);

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      
      if (e.key === 'c' || e.key === 'C') {
        copySelectedImages();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        removeSelectedImages();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelectedImages, selectedIds]);

  // --- 拼图生成导出 ---
  const generateAndDownload = async () => {
    if (images.length === 0 || layoutPages.length === 0) {
        alert("没有可生成的图片");
        return;
    }
    setIsGenerating(true);

    try {
        for (let i = 0; i < layoutPages.length; i++) {
            const pageItems = layoutPages[i];
            if (pageItems.length === 0) continue;

            const canvas = document.createElement('canvas');
            canvas.width = globalParams.canvasWidth;
            canvas.height = globalParams.canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            // 透明背景

            for (const item of pageItems) {
                const imgElement = new Image();
                await new Promise<void>((resolve) => {
                    imgElement.onload = () => resolve();
                    imgElement.src = item.url;
                });

                ctx.save();
                const cx = item.x + item.width / 2;
                const cy = item.y + item.height / 2;
                ctx.translate(cx, cy);

                ctx.rotate(item.rotate * -90 * Math.PI / 180);

                let drawW, drawH;
                if (item.rotate % 2 === 0) {
                    drawW = item.width;
                    drawH = item.height;
                } else {
                    drawW = item.height; 
                    drawH = item.width;
                }

                ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();
            }

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const baseFilename = `${globalParams.exportPrefix}_${i + 1}.png`;
            const cleanPath = downloadPath.replace(/[\\/]+/g, '_').replace(/:/g, '');
            link.download = `${cleanPath}_${baseFilename}`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            await new Promise(r => setTimeout(r, 400));
        }
    } catch (error) {
        console.error("生成大图失败:", error);
        alert("拼接大图生成失败，请检查原图数据。");
    } finally {
        setIsGenerating(false);
    }
  };

  const selectedImage = selectedIds.length === 1 
    ? images.find(img => img.id === selectedIds[0]) 
    : (selectedIds.length > 1 ? images.find(img => img.id === selectedIds[0]) : null);

  const checkerStyle: React.CSSProperties = {
    backgroundImage: 'conic-gradient(#1e293b 90deg, #0f172a 90deg 180deg, #1e293b 180deg 270deg, #0f172a 270deg)',
    backgroundSize: '16px 16px'
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden flex-col md:flex-row">
      
      {/* 左侧：加载及待拼接文件列表 */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col z-10 shrink-0">
        
        {/* 返回工坊导航 */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回创意工坊</span>
          </button>
          <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-mono">
            Stitcher
          </span>
        </div>

        {/* 顶部操作区 */}
        <div className="p-4 border-b border-slate-800 space-y-2.5 bg-slate-950/20">
          <input type="file" multiple accept="image/png, image/jpeg" className="hidden" ref={fileInputRef} onChange={handleLoadFiles} />
          <input type="file" {...({ webkitdirectory: "", directory: "" } as any)} multiple className="hidden" ref={folderInputRef} onChange={handleLoadFolder} />
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-blue-600/10 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>加载零散图片</span>
          </button>
          <button 
            onClick={() => folderInputRef.current?.click()} 
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>加载素材文件夹</span>
          </button>
        </div>

        {/* 图片队列列表 */}
        <div className="p-2.5 border-b border-slate-800 flex justify-between items-center text-xs bg-slate-950/45 select-none shrink-0 font-bold text-slate-400">
          <span>待拼图片 ({images.length})</span>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md cursor-pointer">全选</button>
            {selectedIds.length > 0 && (
              <button onClick={removeSelectedImages} className="text-[10px] px-2 py-0.5 bg-red-950/40 text-red-400 hover:bg-red-900/40 border border-red-900/20 rounded-md cursor-pointer">删除</button>
            )}
          </div>
        </div>
        
        {/* 图片滑动区域 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[220px] md:max-h-none">
          {images.map((img, index) => {
            const isSelected = selectedIds.includes(img.id);
            return (
              <div 
                key={img.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, img.id)}
                onDragEnter={(e) => handleDragEnter(e, img.id)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleSelect(e, img.id)}
                className={`relative flex items-center p-2 rounded-xl cursor-pointer border transition-all select-none
                  ${isSelected ? 'border-blue-500/50 bg-blue-600/15' : 'border-transparent hover:bg-slate-800/50'}
                  ${draggedId === img.id ? 'opacity-40 bg-slate-950 border-dashed border-slate-800' : ''}
                `}
              >
                <div className="w-6 text-[10px] text-slate-500 font-mono font-bold">{index + 1}</div>
                <div className="w-10 h-10 flex-shrink-0 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                  <img 
                    src={img.url} 
                    alt="thumb" 
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    style={{ transform: `rotate(${img.rotate * -90}deg)` }}
                  />
                </div>
                <div className="ml-3 flex-1 overflow-hidden">
                  <div className="text-xs text-slate-300 truncate font-medium">{img.file.name}</div>
                  <div className="text-[10px] font-mono mt-0.5 text-slate-500 font-bold">{img.width} × {img.height} px</div>
                </div>
              </div>
            );
          })}
          {images.length === 0 && (
            <div className="text-center text-xs text-slate-600 py-10 px-4 border border-dashed border-slate-800 rounded-2xl">
              拖拽图片文件到右侧工作区，或者点击上方按钮导入。
            </div>
          )}
        </div>
      </aside>

      {/* 中间：画布工作区 */}
      <main 
        ref={previewRef}
        className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* 缩放调整浮窗 */}
        <div className="absolute top-4 right-4 z-20 flex items-center bg-slate-900 border border-slate-800 rounded-full shadow-2xl overflow-hidden text-slate-400 p-1">
          <button onClick={() => setZoomScale(p => Math.max(0.1, p - 0.05))} className="p-1.5 hover:bg-slate-800 rounded-full transition-all cursor-pointer" title="缩小"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button onClick={() => setZoomScale(0.4)} className="px-3.5 py-1 text-[11px] font-bold font-mono hover:bg-slate-800 rounded-full transition-all text-slate-300 min-w-[54px] text-center cursor-pointer" title="默认100%">
            {Math.round(zoomScale * 100)}%
          </button>
          <button onClick={() => setZoomScale(p => Math.min(5, p + 0.05))} className="p-1.5 hover:bg-slate-800 rounded-full transition-all cursor-pointer" title="放大"><ZoomIn className="w-3.5 h-3.5" /></button>
        </div>

        {/* 虚拟画布容器 */}
        <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
          <div 
              className="relative shrink-0 transition-all duration-200"
              style={{ 
                  width: `${globalParams.canvasWidth * zoomScale}px`, 
                  height: `${globalParams.canvasHeight * zoomScale}px`,
              }}
          >
            {/* 真实物理尺寸画布，使用 CSS Scale 渲染 */}
            <div 
                className="shadow-2xl absolute top-0 left-0 origin-top-left border border-slate-800 rounded overflow-hidden"
                style={{ 
                    width: `${globalParams.canvasWidth}px`, 
                    height: `${globalParams.canvasHeight}px`,
                    transform: `scale(${zoomScale})`,
                    ...checkerStyle
                }}
            >
              {layoutPages[currentPage] && layoutPages[currentPage].map((item) => {
                 const isSelected = selectedIds.includes(item.id);
                 return (
                    <div 
                        key={item.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, item.id); }}
                        onDragEnter={(e) => handleDragEnter(e, item.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleSelect(e, item.id)}
                        className={`absolute border-2 box-border cursor-pointer transition-all duration-200 rounded
                            ${isSelected ? 'border-blue-500 z-10 shadow-lg shadow-blue-500/20' : 'border-transparent hover:border-slate-600 hover:z-10'}
                            ${draggedId === item.id ? 'opacity-40 z-20 scale-95 border-dashed border-blue-500/50' : ''}
                        `}
                        style={{
                            left: `${item.x}px`,
                            top: `${item.y}px`,
                            width: `${item.width}px`,
                            height: `${item.height}px`,
                        }}
                    >
                        <div className="w-full h-full relative flex items-center justify-center overflow-visible pointer-events-none bg-slate-900/40">
                            <img 
                                src={item.url} 
                                alt="" 
                                style={{
                                    width: item.rotate % 2 === 0 ? '100%' : `${item.height}px`,
                                    height: item.rotate % 2 === 0 ? '100%' : `${item.width}px`,
                                    transform: `rotate(${item.rotate * -90}deg)`,
                                    objectFit: 'fill',
                                    position: 'absolute'
                                }}
                            />
                            {/* 拼页索引标识 */}
                            <span className="absolute bottom-1.5 right-1.5 text-[9px] font-mono font-bold bg-slate-950/80 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800 pointer-events-none">
                              {images.findIndex(img => img.id === item.id) + 1}
                            </span>
                        </div>
                    </div>
                 );
              })}
            </div>
          </div>
        </div>

        {/* 底部拼版换页控制器 */}
        {layoutPages.length > 1 && (
           <div className="h-12 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-center gap-4 shrink-0 absolute bottom-0 w-full backdrop-blur-md">
              <button 
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3.5 py-1 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer transition-all active:scale-95 border border-slate-700"
              >上一大版</button>
              <span className="text-xs font-bold text-slate-400 font-mono">版次 {currentPage + 1} / {layoutPages.length}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(layoutPages.length - 1, p + 1))}
                disabled={currentPage === layoutPages.length - 1}
                className="px-3.5 py-1 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer transition-all active:scale-95 border border-slate-700"
              >下一大版</button>
           </div>
        )}
      </main>

      {/* 右侧：单图及大图全局拼接参数面板 */}
      <aside className="w-full md:w-72 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shrink-0">
        
        {/* 顶端单位切换 */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center select-none shrink-0">
          <span className="font-bold text-xs">尺寸计算单位</span>
          <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800/80">
             <button 
               className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${globalParams.unit === 'px' ? 'bg-slate-800 text-blue-400 border border-slate-700/60 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
               onClick={() => setGlobalParams(p => ({...p, unit: 'px'}))}
             >像素 (px)</button>
             <button 
               className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${globalParams.unit === 'cm' ? 'bg-slate-800 text-blue-400 border border-slate-700/60 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
               onClick={() => setGlobalParams(p => ({...p, unit: 'cm'}))}
             >厘米 (cm)</button>
          </div>
        </div>

        {/* 选中单图参数微调 */}
        <div className="p-4 border-b border-slate-800 flex-1 overflow-y-auto">
          <h3 className="font-bold text-xs text-slate-400 mb-4 flex items-center justify-between">
              <span>单项图元属性 {selectedIds.length > 1 && <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full ml-1">已选 {selectedIds.length} 张</span>}</span>
          </h3>
          
          {selectedImage ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">重置宽度 ({globalParams.unit})</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={displayValue(selectedImage.width)}
                    onChange={(e) => handleResize('width', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">重置高度 ({globalParams.unit})</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={displayValue(selectedImage.height)}
                    onChange={(e) => handleResize('height', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={copySelectedImages}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold transition-all active:scale-95 text-slate-300 cursor-pointer"
                  title="在队列里复制这张图 (快捷键: C)"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制图层</span>
                </button>
                <button 
                  onClick={handleRotateSelected}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold transition-all active:scale-95 text-slate-300 cursor-pointer"
                  title="逆时针旋转90度"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>逆时针旋转</span>
                </button>
              </div>
              
              <div className="text-[10px] text-slate-500 leading-relaxed bg-slate-950/20 p-3 rounded-lg border border-slate-900">
                  <span className="font-bold text-slate-400">贴心指南：</span>大图拼接支持自由的拖拽重排，在左侧的列表中直接按住列表元素上下拖动，可以调整图片拼在画布上的先后顺序。
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-xs text-slate-600 text-center px-4 py-8 border border-dashed border-slate-850 rounded-2xl">
              <Move className="w-6 h-6 mb-2 opacity-30" />
              <span>请在左侧列表或工作区点击某张图片进行尺寸和图层旋转调整</span>
            </div>
          )}
        </div>

        {/* 全局大图参数 */}
        <div className="p-4 bg-slate-950/40 border-t border-slate-800/80 space-y-4">
          <h3 className="font-bold text-xs text-slate-300">
              全局大图画布参数
          </h3>
          
          <div className="space-y-3.5">
            {/* 画布尺寸 */}
            <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">拼版尺寸 ({globalParams.unit})</label>
               <div className="flex items-center gap-2">
                  <div className="flex-1">
                      <input 
                          type="number" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 text-center"
                          value={displayValue(globalParams.canvasWidth)}
                          onChange={(e) => setGlobalParams(p => ({...p, canvasWidth: parseInputValue(e.target.value)}))}
                      />
                      <div className="text-[9px] text-slate-500 text-center mt-1 font-bold">Width</div>
                  </div>
                  <button onClick={handleSwapGlobalSize} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer border border-slate-800 bg-slate-900 shrink-0" title="互换横纵比例">
                      <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1">
                      <input 
                          type="number" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 text-center"
                          value={displayValue(globalParams.canvasHeight)}
                          onChange={(e) => setGlobalParams(p => ({...p, canvasHeight: parseInputValue(e.target.value)}))}
                      />
                      <div className="text-[9px] text-slate-500 text-center mt-1 font-bold">Height</div>
                  </div>
               </div>
            </div>

            {/* 间隔设置 */}
            <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">图片拼版间隔 ({globalParams.unit})</label>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                      <input 
                          type="number" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                          value={displayValue(globalParams.gapX)}
                          onChange={(e) => setGlobalParams(p => ({...p, gapX: parseInputValue(e.target.value)}))}
                      />
                      <div className="text-[9px] text-slate-500 mt-1 font-bold">X 横向间距</div>
                  </div>
                  <div>
                      <input 
                          type="number" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                          value={displayValue(globalParams.gapY)}
                          onChange={(e) => setGlobalParams(p => ({...p, gapY: parseInputValue(e.target.value)}))}
                      />
                      <div className="text-[9px] text-slate-500 mt-1 font-bold">Y 纵向间距</div>
                  </div>
               </div>
            </div>

            {/* DPI / 打印换算 */}
            <div className="pt-2.5 border-t border-slate-850">
                <label className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">打印 DPI</span>
                    <input 
                        type="number" 
                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right text-slate-200"
                        value={globalParams.dpi}
                        onChange={(e) => setGlobalParams(p => ({...p, dpi: parseInt(e.target.value) || 300}))}
                    />
                </label>
            </div>

            {/* 导出前缀 */}
            <div className="pt-2.5 border-t border-slate-850">
               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">导出文件前缀</label>
               <input 
                   type="text" 
                   className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                   value={globalParams.exportPrefix}
                   onChange={(e) => setGlobalParams(p => ({...p, exportPrefix: e.target.value}))}
                   placeholder=" stitch_export"
               />
               <div className="pt-2.5 border-t border-slate-850/40 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                   <span>配置下载路径:</span>
                   <span className="font-mono text-slate-400 break-all max-w-[150px] text-right" title={downloadPath}>{downloadPath}</span>
               </div>
            </div>
          </div>
        </div>

        {/* 底部生成按钮 */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
          <button 
            onClick={generateAndDownload} 
            disabled={isGenerating || images.length === 0}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer text-white
              ${(isGenerating || images.length === 0) ? 'bg-slate-800 text-slate-500 border border-slate-800/80 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/10'}`}
          >
            {isGenerating ? (
              <span className="animate-pulse">正在排列并生成大版中...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>生成并打包下载大图</span>
              </>
            )}
          </button>
        </div>
        
      </aside>
    </div>
  );
}
