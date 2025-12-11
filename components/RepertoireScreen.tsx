
import React, { useState } from 'react';
import { Music, Plus, Trash2, ExternalLink, PlayCircle, Calendar, Settings, ListMusic, Sparkles, Loader2, Search } from 'lucide-react';
import { RepertoireItem, User } from '../types';
import { useToast } from './Toast';
import { addToRepertoire, deleteFromRepertoire } from '../services/supabaseService';
import { suggestRepertoireAI } from '../services/aiService';

interface Props {
  repertoire: RepertoireItem[];
  setRepertoire: (items: RepertoireItem[]) => Promise<void>;
  currentUser: User | null;
  mode: 'view' | 'manage';
  onItemAdd?: (title: string) => void;
}

export const RepertoireScreen: React.FC<Props> = ({ repertoire, setRepertoire, currentUser, mode, onItemAdd }) => {
  const { addToast, confirmAction } = useToast();
  
  // Form State
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [date, setDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTheme, setAiTheme] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{title: string, artist: string, reason: string}[]>([]);

  // Extrai ID de vídeo único
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Extrai ID de Playlist
  const getPlaylistId = (url: string) => {
    const regExp = /[?&]list=([^#\&\?]+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const getGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c1 = Math.abs(hash % 360);
    const c2 = (c1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${c1}, 70%, 60%), hsl(${c2}, 70%, 40%))`;
  };

  const handleAdd = async (overrideTitle?: string, overrideLink?: string) => {
    const finalTitle = overrideTitle || title;
    const finalLink = overrideLink || link;

    if (!finalTitle || !date) {
        addToast("Preencha título e data.", "error");
        return;
    }

    if (!currentUser?.ministryId) {
        addToast("Erro: Ministério não identificado.", "error");
        return;
    }

    setIsSubmitting(true);
    
    // Add via SQL Service
    await addToRepertoire(currentUser.ministryId, {
        title: finalTitle,
        link: finalLink,
        date,
        addedBy: currentUser.name
    });

    if (onItemAdd) onItemAdd(finalTitle);
    
    await setRepertoire([]); 
    
    if (!overrideTitle) {
        setTitle("");
        setLink("");
    }
    setIsSubmitting(false);
    addToast("Música adicionada!", "success");
  };

  const handleAiSuggest = async () => {
      if (!aiTheme) return;
      setAiLoading(true);
      const results = await suggestRepertoireAI(aiTheme);
      setAiSuggestions(results);
      setAiLoading(false);
  };

  const handleDelete = (id: string) => {
      confirmAction("Excluir Item", "Tem certeza que deseja remover este item do repertório?", async () => {
          await deleteFromRepertoire(id);
          await setRepertoire([]); // Trigger reload
          addToast("Item removido.", "success");
      });
  };

  const groupedRepertoire = repertoire.reduce((acc, item) => {
      const dateKey = item.date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
  }, {} as Record<string, RepertoireItem[]>);

  const sortedDates = Object.keys(groupedRepertoire).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            {mode === 'manage' ? <Settings className="text-pink-500"/> : <Music className="text-pink-500"/>}
            {mode === 'manage' ? 'Gerenciar Repertório' : 'Repertório Musical'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            {mode === 'manage' 
                ? 'Adicione, edite e remova músicas ou playlists dos cultos.' 
                : 'Lista de louvores e referências para os próximos cultos.'}
          </p>
        </div>
      </div>

      {mode === 'manage' && (
          <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                      <Plus size={14}/> Adicionar Novo Item
                  </h3>
                  <button 
                    onClick={() => setShowAiModal(!showAiModal)}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-purple-100 transition-colors"
                  >
                      <Sparkles size={14} /> Sugestão IA
                  </button>
              </div>

              {/* AI Suggestions Panel */}
              {showAiModal && (
                  <div className="mb-6 p-4 bg-purple-50 dark:bg-zinc-900/50 rounded-xl border border-purple-100 dark:border-zinc-700">
                      <div className="flex gap-2 mb-4">
                          <input 
                             placeholder="Ex: Páscoa, Gratidão, Culto Jovem..." 
                             value={aiTheme}
                             onChange={e => setAiTheme(e.target.value)}
                             className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button 
                             onClick={handleAiSuggest}
                             disabled={aiLoading || !aiTheme}
                             className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                          >
                              {aiLoading ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
                              Buscar
                          </button>
                      </div>
                      
                      {aiSuggestions.length > 0 && (
                          <div className="space-y-2">
                              {aiSuggestions.map((sug, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-3 rounded-lg border border-purple-100 dark:border-zinc-700">
                                      <div>
                                          <p className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{sug.title} <span className="font-normal text-zinc-500">- {sug.artist}</span></p>
                                          <p className="text-xs text-purple-500 italic">{sug.reason}</p>
                                      </div>
                                      <button 
                                        onClick={() => {
                                            setTitle(`${sug.title} - ${sug.artist}`);
                                            // Auto-fill title but user needs to set date/link or we can allow direct add if we want
                                            addToast("Título preenchido! Selecione a data e adicione o link.", "info");
                                        }}
                                        className="text-xs bg-zinc-100 dark:bg-zinc-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded transition-colors"
                                      >
                                          Usar
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                      <label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Data do Culto</label>
                      <input 
                          type="date" 
                          value={date} 
                          onChange={e => setDate(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                      />
                  </div>
                  <div className="md:col-span-1">
                      <label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Título</label>
                      <input 
                          type="text" 
                          placeholder="Ex: Todavia Me Alegrarei"
                          value={title} 
                          onChange={e => setTitle(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                      />
                  </div>
                  <div className="md:col-span-1">
                      <label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Link YouTube</label>
                      <input 
                          type="text" 
                          placeholder="Link do vídeo ou playlist..."
                          value={link} 
                          onChange={e => setLink(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                      />
                  </div>
                  <div className="flex items-end">
                      <button 
                          onClick={() => handleAdd()}
                          disabled={isSubmitting}
                          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                          {isSubmitting ? 'Salvando...' : 'Adicionar'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="space-y-8">
          {sortedDates.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <Music className="mx-auto mb-3 opacity-20" size={48}/>
                  <p>Nenhum louvor cadastrado ainda.</p>
              </div>
          ) : (
              sortedDates.map(dateKey => {
                  const [y, m, d] = dateKey.split('-');
                  const formattedDate = `${d}/${m}/${y}`;
                  
                  return (
                      <div key={dateKey} className="animate-slide-up">
                          <div className="flex items-center gap-2 mb-3 px-1">
                              <div className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 p-1.5 rounded-lg">
                                  <Calendar size={16} />
                              </div>
                              <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-lg">Culto {formattedDate}</h3>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {groupedRepertoire[dateKey].map(item => {
                                  const videoId = getYouTubeId(item.link);
                                  const isPlaylist = getPlaylistId(item.link);
                                  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';

                                  return (
                                      <div key={item.id} className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all group">
                                          <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                                              {thumbnailUrl ? (
                                                  <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                              ) : (
                                                  <div 
                                                    className="w-full h-full flex flex-col items-center justify-center text-white p-4 text-center relative"
                                                    style={{ background: getGradient(item.title + item.id) }}
                                                  >
                                                      <div className="absolute inset-0 bg-black/20" />
                                                      <div className="relative z-10">
                                                          <ListMusic size={32} className="mb-2 opacity-90 mx-auto drop-shadow-md"/>
                                                          <span className="text-xs font-bold uppercase tracking-widest opacity-90 drop-shadow-sm line-clamp-2">
                                                              {item.title}
                                                          </span>
                                                      </div>
                                                  </div>
                                              )}
                                              
                                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                                  <a 
                                                      href={item.link} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform z-20"
                                                  >
                                                      {isPlaylist ? <ListMusic size={24} /> : <PlayCircle size={28} fill="white" />}
                                                  </a>
                                              </div>
                                              
                                              {mode === 'manage' && (
                                                  <button 
                                                      onClick={() => handleDelete(item.id)}
                                                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 z-30"
                                                      title="Excluir"
                                                  >
                                                      <Trash2 size={14} />
                                                  </button>
                                              )}
                                          </div>
                                          
                                          <div className="p-4">
                                              <h4 className="font-bold text-zinc-800 dark:text-white line-clamp-1" title={item.title}>
                                                  {item.title}
                                              </h4>
                                              <div className="flex justify-between items-center mt-2">
                                                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                                      {isPlaylist ? 'Playlist' : 'Youtube'}
                                                  </span>
                                                  <a 
                                                      href={item.link} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 font-medium"
                                                  >
                                                      Abrir <ExternalLink size={12} />
                                                  </a>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })
          )}
      </div>
    </div>
  );
};
