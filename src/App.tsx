import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Scissors, Layers, CheckCircle, ShieldAlert, Cpu, Sparkles, ArrowRight, ArrowLeft, Settings, Folder, Save, FileJson, Check } from 'lucide-react';
import ChromaTool from './components/ChromaTool';
import SpriteTool from './components/SpriteTool';
import StitchTool from './components/StitchTool';

type ToolType = 'chroma' | 'sprite' | 'stitch' | null;

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const savedPath = localStorage.getItem('imagecraft_download_path');
    return {
      downloadPath: savedPath || 'D:\\Download'
    };
  });
  const [tempPath, setTempPath] = useState(settings.downloadPath);

  const openSettings = () => {
    setTempPath(settings.downloadPath);
    setShowSettings(true);
  };

  const handleSaveSettings = () => {
    const updated = { downloadPath: tempPath || 'D:\\Download' };
    setSettings(updated);
    localStorage.setItem('imagecraft_download_path', updated.downloadPath);
    setShowSettings(false);
  };

  const handleExportConfig = () => {
    const configData = {
      downloadPath: tempPath || 'D:\\Download',
      exportEngine: "Pure Front-end",
      updatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanPath = (tempPath || 'D:\\Download').replace(/[\\/]+/g, '_').replace(/:/g, '');
    a.download = `${cleanPath}_settings_config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 卡片配置数据
  const tools = [
    {
      id: 'chroma' as const,
      name: '批量抠绿幕与裁剪',
      subtitle: 'CHROMA KEY & CROP',
      desc: '专为大批量图片设计的绿幕抠图和像素级裁切工具。通过高精度的色彩容差和可视选区，一键剔除多余底色，并自动裁剪指定区域导出。',
      color: 'from-emerald-500/20 to-teal-500/20',
      borderColor: 'group-hover:border-emerald-500/50',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      glowColor: 'shadow-emerald-500/5',
      badge: 'Chroma Filter',
      icon: Palette,
      features: [
        '智能吸管，多容差绿幕与特定色剔除',
        '九宫格参考线，自由矩形裁剪选区',
        '大批量图片的一键后台极速打包导出',
        '自适应导出分辨率，支持比例缩放与锁定'
      ]
    },
    {
      id: 'sprite' as const,
      name: '动画序列帧微调工坊',
      subtitle: 'SPRITE SHEET TUNER',
      desc: '专为2D像素及手绘游戏设计师打造。支持导入整张大图集自动按网格切分，或导入多张单帧，对每帧的骨骼位移(Offset)进行像素微调，对齐抖动。',
      color: 'from-indigo-500/20 to-violet-500/20',
      borderColor: 'group-hover:border-indigo-500/50',
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
      glowColor: 'shadow-indigo-500/5',
      badge: 'Sprite Align',
      icon: Scissors,
      features: [
        '大图一键解析格切、多帧快速合帧',
        '精细到 1 像素的各帧偏移(Offset)微调',
        '实时 GIF 多轨动画无限循环流畅预览',
        '支持导出重组大图集与单独多帧切片'
      ]
    },
    {
      id: 'stitch' as const,
      name: '智能拼版大图拼接器',
      subtitle: 'GRID STITCH & LAYOUT',
      desc: '高自适应性的多功能画版拼接工具。支持大版幅画布，可自由添加大批量素材并上下拖动排序，灵活配置边距间隔，实现超高清巨图拼版输出。',
      color: 'from-sky-500/20 to-blue-500/20',
      borderColor: 'group-hover:border-sky-500/50',
      iconColor: 'text-sky-400',
      iconBg: 'bg-sky-500/10 border-sky-500/20',
      glowColor: 'shadow-sky-500/5',
      badge: 'Grid Stitcher',
      icon: Layers,
      features: [
        '一键导入数千张零散素材或单文件夹',
        '支持拖拽式物理卡片位置与拼图顺序重排',
        '厘米(cm) / 像素(px) 双单位自适应换算',
        '全局多版式自动分页、高保真大图导出'
      ]
    }
  ];

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* 霓虹氛围背景光晕 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>

      <AnimatePresence mode="wait">
        {activeTool === null ? (
          // --- 入口主页 (Dashboard) ---
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="relative flex flex-col justify-between min-h-screen w-full"
          >
            {/* 顶栏 */}
            <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-slate-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="font-black text-lg tracking-wider bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  IMAGECRAFT
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3.5 py-1.5 rounded-full shadow-inner select-none">
                  <Cpu className="w-3.5 h-3.5 animate-pulse" />
                  <span>纯前端无服务器引擎，绝对保护您的图片隐私安全</span>
                </div>
                
                <button
                  onClick={openSettings}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 px-4 py-2 rounded-xl border border-slate-800 hover:border-slate-700 transition-all cursor-pointer shadow-lg active:scale-95 group"
                >
                  <Settings className="w-4 h-4 text-slate-400 group-hover:text-white" />
                  <span>设置</span>
                </button>
              </div>
            </header>

            {/* 英雄区 (Hero Section) */}
            <div className="max-w-4xl mx-auto text-center px-6 pt-16 pb-12 shrink-0">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4 text-white">
                  一站式{' '}
                  <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-sky-400 bg-clip-text text-transparent">
                    专业级图片创意处理
                  </span>{' '}
                  工坊
                </h1>
                <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  ImageCraft 完美整合了“批量绿幕色度抠除、游戏角色序列帧骨骼抖动对齐以及像素/厘米级排版拼版大图拼接”三大高阶前沿工具。极简纯净、流畅舒适。
                </p>
              </motion.div>
            </div>

            {/* 三大工具卡片区域 */}
            <main className="max-w-7xl mx-auto w-full px-6 pb-24 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
              {tools.map((tool, idx) => {
                const IconComp = tool.icon;
                return (
                  <motion.div
                    key={tool.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1, duration: 0.4, ease: 'easeOut' }}
                    onClick={() => setActiveTool(tool.id)}
                    className="group relative flex flex-col justify-between bg-slate-900/40 hover:bg-slate-900/80 rounded-3xl p-6 border border-slate-900 hover:border-slate-800 transition-all duration-300 shadow-2xl cursor-pointer hover:-translate-y-1 select-none overflow-hidden"
                  >
                    {/* 卡片背光发光 */}
                    <div className={`absolute -right-20 -top-20 w-40 h-40 rounded-full bg-gradient-to-br ${tool.color} blur-[50px] opacity-20 group-hover:opacity-60 transition-all duration-300`}></div>

                    <div className="space-y-5">
                      {/* 头部图标及标签 */}
                      <div className="flex items-center justify-between">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${tool.iconBg} transition-all`}>
                          <IconComp className={`w-5 h-5 ${tool.iconColor}`} />
                        </div>
                        <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest bg-slate-950/85 px-3 py-1 rounded-full border border-slate-900">
                          {tool.badge}
                        </span>
                      </div>

                      {/* 卡片标题 */}
                      <div>
                        <span className="block text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">
                          {tool.subtitle}
                        </span>
                        <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                          {tool.name}
                        </h2>
                        <p className="text-xs text-slate-400 mt-2.5 leading-relaxed font-medium">
                          {tool.desc}
                        </p>
                      </div>

                      {/* 核心功能列表 */}
                      <div className="pt-4 border-t border-slate-900 space-y-2.5">
                        {tool.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-start gap-2 text-[11px] text-slate-400">
                            <CheckCircle className={`w-3.5 h-3.5 ${tool.iconColor} shrink-0 mt-0.5`} />
                            <span className="leading-normal font-medium">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 卡片底部操作按钮 */}
                    <div className="mt-8 pt-4 border-t border-slate-900 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
                      <span>启动此核心模块</span>
                      <div className={`w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center border border-slate-900 group-hover:border-slate-800 transition-all ${tool.glowColor}`}>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </main>

            {/* 底部版权 */}
            <footer className="max-w-7xl mx-auto w-full px-6 py-8 border-t border-slate-900 text-center flex flex-col sm:flex-row items-center justify-between text-slate-600 text-xs gap-3 shrink-0">
              <span className="font-semibold">ImageCraft Studios © 2026. 极简高雅的专业级图片流水线。</span>
              <div className="flex gap-4 font-medium">
                <span className="hover:text-slate-400 transition-colors cursor-pointer">隐私保护条款</span>
                <span className="hover:text-slate-400 transition-colors cursor-pointer font-mono">Build v2.4.0</span>
              </div>
            </footer>
          </motion.div>
        ) : (
          // --- 启动具体工具组件 (带流畅转换过渡) ---
          <motion.div
            key="active-tool"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full min-h-screen"
          >
            {activeTool === 'chroma' && <ChromaTool onBack={() => setActiveTool(null)} downloadPath={settings.downloadPath} />}
            {activeTool === 'sprite' && <SpriteTool onBack={() => setActiveTool(null)} downloadPath={settings.downloadPath} />}
            {activeTool === 'stitch' && <StitchTool onBack={() => setActiveTool(null)} downloadPath={settings.downloadPath} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 全局设置弹窗/面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ duration: 0.3 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
            >
              {/* 头部 */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block mb-1">IMAGE CRAFT SETTINGS</span>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    全局参数设置
                  </h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-100 transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>

              {/* 设置表单内容 */}
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    下载路径 (Download Path):
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Folder className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={tempPath}
                        onChange={(e) => setTempPath(e.target.value)}
                        placeholder="D:\Download"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => setTempPath('D:\\Download')}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition-all cursor-pointer"
                    >
                      默认
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    由于网页沙箱安全限制，浏览器会将文件保存到浏览器默认的“下载”目录中。为了兼容本工具的路径配置，下载时文件名将自动带入此路径层次前缀（如 <code>D_Download_文件名.png</code>），部分智能下载器可根据此规则直接归类入库。
                  </p>
                </div>

                {/* 文件名样式动态演示区 */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">导出文件名渲染示例</span>
                  <div className="font-mono text-xs text-slate-300 break-all space-y-1.5 leading-relaxed">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">原图片名:</span>
                      <span>character_run_01.png</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-slate-500">带路径导出名:</span>
                      <span className="text-blue-400 font-bold">
                        {(() => {
                          const clean = tempPath.replace(/[\\/]+/g, '_').replace(/:/g, '');
                          return `${clean}_character_run_01.png`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 底部按钮栏 */}
              <div className="p-6 border-t border-slate-800 flex gap-3 bg-slate-950/20">
                <button
                  onClick={handleExportConfig}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-2xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                  title="保存配置至下载路径下的JSON文件"
                >
                  <FileJson className="w-4 h-4 text-purple-400" />
                  <span>导出配置文件</span>
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>保存并应用</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
