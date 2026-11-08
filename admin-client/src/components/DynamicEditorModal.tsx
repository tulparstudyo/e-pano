import React, { useState } from 'react';

interface ModalProps {
  componentKey: string;
  data: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, updatedData: any) => void;
  uploadEndpoint: string;
}

export const DynamicEditorModal: React.FC<ModalProps> = ({
  componentKey,
  data,
  isOpen,
  onClose,
  onSave,
  uploadEndpoint
}) => {
  if (!isOpen || !data) return null;

  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(data)));
  const [isUploading, setIsUploading] = useState(false);
  const [newTickerItem, setNewTickerItem] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const body = new FormData();
    body.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch(uploadEndpoint, { method: 'POST', body });
      if (!res.ok) throw new Error('Yukleme basarisiz.');
      const mediaItem = await res.json();
      setFormData((prev: any) => ({
        ...prev,
        items: [...(prev.items || []), mediaItem]
      }));
    } catch (err) {
      alert('Dosya yuklenirken hata olustu: ' + (err as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const renderFieldControls = () => {
    switch (formData.type) {
      case 'text':
      case 'richtext':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bilesen Basligi
              </label>
              <input
                type="text"
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Metin Icerigi
              </label>
              <textarea
                className="w-full h-32 p-3 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500 resize-none"
                value={formData.value || ''}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </div>
          </div>
        );

      case 'media_slider':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
              <span className="text-xs font-semibold text-slate-300">
                Slayt Gecis Suresi (Saniye)
              </span>
              <input
                type="number"
                min={2}
                max={60}
                className="w-20 p-1.5 bg-slate-900 border border-slate-700 rounded text-center text-slate-100 text-sm"
                value={formData.durationSec || 8}
                onChange={(e) => setFormData({ ...formData, durationSec: Number(e.target.value) })}
              />
            </div>

            <div className="border-2 border-dashed border-slate-700 rounded-lg p-5 text-center bg-slate-800/40 hover:bg-slate-800/70 transition">
              <input
                type="file"
                id="mediaUploadInput"
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <label
                htmlFor="mediaUploadInput"
                className="cursor-pointer text-xs font-semibold text-blue-400 hover:text-blue-300 block"
              >
                {isUploading ? 'Dosya Sunucuya Yukleniyor...' : '📁 Bilgisayardan Resim veya Video Sec'}
              </label>
              <span className="text-[11px] text-slate-400 mt-1 block">
                JPG, PNG, WebP veya MP4 formatlari desteklenir (Maks: 500MB)
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                Mevcut Medya Listesi ({formData.items?.length || 0})
              </span>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-900 rounded border border-slate-800">
                {formData.items?.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="relative group border border-slate-700 rounded overflow-hidden bg-slate-800">
                    {item.mediaType === 'video' ? (
                      <div className="h-20 flex flex-col items-center justify-center bg-slate-950 text-slate-400 text-xs p-1">
                        <span>🎬 Video</span>
                        <span className="text-[9px] truncate max-w-full text-slate-400">{item.id}</span>
                      </div>
                    ) : (
                      <img src={item.url} alt="slide" className="h-20 w-full object-cover" />
                    )}
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-90 group-hover:opacity-100"
                      onClick={() => {
                        const nextItems = formData.items.filter((_: any, i: number) => i !== idx);
                        setFormData({ ...formData, items: nextItems });
                      }}
                      title="Sil"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'repeater_table':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Tablo Basligi</label>
                <input
                  type="text"
                  className="p-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs w-64"
                  value={formData.label || ''}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                onClick={() => {
                  const newRow = (formData.columns || []).reduce(
                    (acc: any, col: string) => ({ ...acc, [col]: '' }),
                    {}
                  );
                  setFormData({ ...formData, rows: [...(formData.rows || []), newRow] });
                }}
              >
                + Yeni Satir Ekle
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-700 rounded bg-slate-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-300 border-b border-slate-700">
                    {(formData.columns || []).map((col: string) => (
                      <th key={col} className="p-2 font-semibold">{col}</th>
                    ))}
                    <th className="p-2 text-center w-12">Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.rows || []).map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                      {formData.columns?.map((col: string) => (
                        <td key={col} className="p-1">
                          <input
                            type="text"
                            className="w-full p-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                            value={row[col] || ''}
                            onChange={(e) => {
                              const rows = [...formData.rows];
                              rows[rIdx][col] = e.target.value;
                              setFormData({ ...formData, rows });
                            }}
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          className="text-rose-400 hover:text-rose-300 font-bold px-1"
                          onClick={() => {
                            const rows = formData.rows.filter((_: any, i: number) => i !== rIdx);
                            setFormData({ ...formData, rows });
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'ticker':
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Yeni alt bant duyurusu yazin..."
                className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                value={newTickerItem}
                onChange={(e) => setNewTickerItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTickerItem.trim()) {
                    setFormData({
                      ...formData,
                      messages: [...(formData.messages || []), newTickerItem.trim()]
                    });
                    setNewTickerItem('');
                  }
                }}
              />
              <button
                type="button"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                onClick={() => {
                  if (newTickerItem.trim()) {
                    setFormData({
                      ...formData,
                      messages: [...(formData.messages || []), newTickerItem.trim()]
                    });
                    setNewTickerItem('');
                  }
                }}
              >
                Ekle
              </button>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {(formData.messages || []).map((msg: string, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700 text-xs">
                  <span className="text-slate-200 flex-1 truncate pr-2">{msg}</span>
                  <button
                    type="button"
                    className="text-rose-400 hover:text-rose-300 font-bold"
                    onClick={() => {
                      const messages = formData.messages.filter((_: any, i: number) => i !== idx);
                      setFormData({ ...formData, messages });
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return <div className="text-sm text-slate-400">Bilinmeyen bilesen tipi.</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-xl w-full p-6 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Bilesen Duzenle: <span className="text-blue-400 font-mono">{componentKey}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg">
            ✕
          </button>
        </div>

        {renderFieldControls()}

        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
            onClick={onClose}
          >
            Vazgec
          </button>
          <button
            type="button"
            className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 text-xs font-bold transition shadow-md shadow-blue-900/30"
            onClick={() => {
              onSave(componentKey, formData);
              onClose();
            }}
          >
            Degisiklikleri Uygula
          </button>
        </div>
      </div>
    </div>
  );
};
