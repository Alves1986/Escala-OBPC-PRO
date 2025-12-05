
import React, { useState } from 'react';
import { Music, Plus, Trash2, ExternalLink, PlayCircle, Calendar, Settings } from 'lucide-react';
import { RepertoireItem, User } from '../types';
import { useToast } from './Toast';

interface Props {
  repertoire: RepertoireItem[];
  setRepertoire: (items: RepertoireItem[]) => Promise<void>;
  currentUser: User | null;
  mode: 'view' | 'manage';
}

export const RepertoireScreen: React.FC<Props> = ({ repertoire, setRepertoire, currentUser, mode }) => {
  const { addToast, confirmAction } = useToast();
  
  // Form State
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [date, setDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleAdd = async () => {
    if (!title || !link || !date) {
        addToast("Preencha todos os campos.", "error");
        return;
    }

    const videoId = getYouTubeId(link);
    if (!videoId) {
        addToast("Link do YouTube inválido.", "error");
        return;
    }

    setIsSubmitting(true);
    const newItem: RepertoireItem = {
        id: Date.now().toString(),
        title,
        link,
        date,
        addedBy: currentUser?.name || 'Admin',
        createdAt: new Date().toISOString()
    };

    const newRepertoire = [newItem, ...repertoire];
    await setRepertoire(newRepertoire);
    
    setTitle("");
    setLink("");
    setIsSubmitting(false);
    addToast("Música adicionada ao repertório!", "success");
  };

  const handleDelete = (id: string) => {
      confirmAction("Excluir Música", "Tem certeza que deseja remover esta música do repertório?", async () => {
          const newRepertoire = repertoire.filter(item => item.id !== id);
          await setRepertoire(newRepertoire);
          addToast("Música removida.", "success");
      });
  };

  // Group items by date
  const groupedRepertoire = repertoire.reduce((acc, item) => {
      const dateKey = item.date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
  }, {} as Record<string, RepertoireItem[]>);

  // Sort dates (newest first)
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
                ? 'Adicione, edite e remova as músicas dos cultos.' 
                : 'Lista de louvores e referências para os próximos cultos.'}
          </p>
        </div>
      </div>

      {/* Admin Form - Only visible in MANAGE mode */}
      {mode === 'manage' && (
          <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-fade-in">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                  <Plus size={14}/> Adicionar Novo Louvor
              </h3>
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
                      <label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Nome da Música</label>
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
                          placeholder="Cole o link aqui..."
                          value={link} 
                          onChange={e => setLink(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                      />
                  </div>
                  <div className="flex items-end">
                      <button 
                          onClick={handleAdd}
                          disabled={isSubmitting}
                          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                          {isSubmitting ? 'Salvando...' : 'Adicionar'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* List View */}
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
                                  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';

                                  return (
                                      <div key={item.id} className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all group">
                                          {/* Thumbnail Area */}
                                          <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                                              {thumbnailUrl && (
                                                  <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                              )}
                                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                                  <a 
                                                      href={item.link} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform"
                                                  >
                                                      <PlayCircle size={28} fill="white" />
                                                  </a>
                                              </div>
                                              {mode === 'manage' && (
                                                  <button 
                                                      onClick={() => handleDelete(item.id)}
                                                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                      title="Excluir"
                                                  >
                                                      <Trash2 size={14} />
                                                  </button>
                                              )}
                                          </div>
                                          
                                          {/* Content */}
                                          <div className="p-4">
                                              <h4 className="font-bold text-zinc-800 dark:text-white line-clamp-1" title={item.title}>
                                                  {item.title}
                                              </h4>
                                              <div className="flex justify-between items-center mt-2">
                                                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                                      Youtube
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
