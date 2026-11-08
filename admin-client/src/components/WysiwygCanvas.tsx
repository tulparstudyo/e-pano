import React from 'react';

interface Props {
  boardData: any;
  onSelectComponent: (key: string) => void;
}

export const WysiwygCanvas: React.FC<Props> = ({ boardData, onSelectComponent }) => {
  const comp = boardData.components || {};
  const layoutId = boardData.layoutId || 'layout-classic-school';

  return (
    <div className="w-[1024px] h-[576px] bg-slate-950 text-white rounded-xl shadow-2xl overflow-hidden border border-slate-700/80 flex flex-col select-none relative transition-all">
      {/* Üst Bar (Header / Title) */}
      <div
        onClick={() => onSelectComponent('title')}
        className={`h-14 px-6 flex items-center justify-between cursor-pointer border-2 border-transparent hover:border-blue-400 transition ${
          layoutId === 'layout-hospital-triaj' ? 'bg-red-950/80 border-b border-red-800' : 'bg-blue-950/80 border-b border-blue-800'
        }`}
        title="Başlığı Düzenle"
      >
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-extrabold text-lg tracking-wide uppercase">
            {comp.title?.value || 'BAŞLIK BELİRTİLMEDİ'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-800 text-blue-300 px-2 py-0.5 rounded border border-slate-700">
            Tıkla: Başlığı Düzenle
          </span>
          <span className="font-mono text-sm text-slate-300">12:45:00</span>
        </div>
      </div>

      {/* Ana Gövde (Layout Türüne Göre Grid Düzeni) */}
      <div className={`flex-1 p-4 gap-4 overflow-hidden grid ${
        layoutId === 'layout-hospital-triaj' 
          ? 'grid-cols-[45%_55%]' 
          : layoutId === 'layout-corporate-grid' 
            ? 'grid-cols-[68%_32%]' 
            : 'grid-cols-[60%_40%]'
      }`}>
        {/* Sol Panel: Medya Slider Bileşeni */}
        <div
          onClick={() => onSelectComponent('slider')}
          className="bg-slate-900 rounded-lg border-2 border-dashed border-slate-700 hover:border-blue-400 cursor-pointer flex flex-col items-center justify-center relative p-3 transition group"
        >
          {comp.slider?.items && comp.slider.items.length > 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden rounded">
              {comp.slider.items[0].mediaType === 'video' ? (
                <div className="text-slate-400 flex flex-col items-center">
                  <span className="text-4xl">🎬</span>
                  <span className="text-xs mt-2 font-mono">{comp.slider.items[0].id}</span>
                </div>
              ) : (
                <img
                  src={comp.slider.items[0].url}
                  alt="Slide preview"
                  className="w-full h-full object-cover rounded opacity-80 group-hover:opacity-100 transition"
                />
              )}
              <div className="absolute top-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[11px] text-amber-300 font-mono">
                {comp.slider.items.length} Medya • {comp.slider.durationSec}s Döngü
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500">
              <span className="text-3xl block mb-2">🖼</span>
              <span className="text-xs font-semibold">+ Medya (Resim / Video) Eklemek İçin Tıklayın</span>
            </div>
          )}
          <span className="absolute bottom-2 right-2 text-[10px] bg-slate-800 text-blue-400 px-2 py-0.5 rounded border border-slate-700">
            Slider Alanı
          </span>
        </div>

        {/* Sağ Panel: Tekrarlayan Veri / Tablo Bileşeni */}
        <div
          onClick={() => onSelectComponent('infoTable')}
          className={`rounded-lg border-2 border-dashed border-slate-700 hover:border-blue-400 cursor-pointer flex flex-col p-4 relative transition ${
            layoutId === 'layout-hospital-triaj' ? 'bg-slate-900/90 border-l-4 border-l-red-500' : 'bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
              {comp.infoTable?.label || 'Bilgi Tablosu'}
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              Tablo Alanı
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  {(comp.infoTable?.columns || []).map((c: string) => (
                    <th key={c} className="pb-1 font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(comp.infoTable?.rows || []).slice(0, 5).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-slate-800/60">
                    {(comp.infoTable?.columns || []).map((c: string) => (
                      <td key={c} className="py-2 text-slate-200 truncate max-w-[120px]">
                        {row[c] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Alt Kayan Yazı Bileşeni (Ticker / Marquee) */}
      <div
        onClick={() => onSelectComponent('ticker')}
        className="h-10 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between cursor-pointer border-2 border-transparent hover:border-blue-400 transition"
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 mr-4">
          <span className="text-xs font-bold text-amber-400 shrink-0">DUYURU:</span>
          <span className="text-xs text-amber-300 truncate">
            {comp.ticker?.messages && comp.ticker.messages.length > 0 
              ? comp.ticker.messages.join('  •  ')
              : 'Henüz duyuru mesajı eklenmedi.'}
          </span>
        </div>
        <span className="text-[10px] bg-slate-800 text-blue-300 px-2 py-0.5 rounded shrink-0">
          Tıkla: Kayan Yazı
        </span>
      </div>
    </div>
  );
};
