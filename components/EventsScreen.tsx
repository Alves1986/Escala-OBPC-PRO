import React from 'react';

export const EventsScreen: React.FC<any> = ({ rules }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed">
      <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-2">Regras de Agenda</h3>
      <p className="text-zinc-500 max-w-md">
        O sistema de eventos recorrentes está sendo atualizado. Por favor, utilize o calendário ou o botão "Adicionar Evento" para gerenciar a escala deste mês.
      </p>
    </div>
  );
};