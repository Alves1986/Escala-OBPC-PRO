
import React, { useState } from 'react';
import { Share2, Download, ExternalLink, QrCode, Copy, Check } from 'lucide-react';
import { useToast } from './Toast';

export const SocialMediaScreen: React.FC = () => {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const qrCodeUrl = "https://i.ibb.co/DPqSFPdq/QR-Code-OBPC.png";
  
  // Link de destino (opcional, se você quiser colocar um botão para ir direto)
  // Assumindo que o QR code leva para um linktree ou instagram, deixo genérico ou sem link direto por enquanto,
  // mas adicionei a lógica de download da imagem.

  const handleDownload = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "QRCode-OBPC.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast("QR Code baixado com sucesso!", "success");
    } catch (error) {
      console.error(error);
      // Fallback para abrir em nova aba se o download falhar (CORS)
      window.open(qrCodeUrl, '_blank');
    }
  };

  const handleCopyLink = () => {
    // Como é uma imagem, copiamos a URL da imagem para a área de transferência
    navigator.clipboard.writeText(qrCodeUrl);
    setCopied(true);
    addToast("Link do QR Code copiado!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-md mx-auto pb-10">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
          <Share2 className="text-purple-500"/> Redes Sociais
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Compartilhe nossas conexões com visitantes e membros.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden relative">
          {/* Decorative Header Background */}
          <div className="h-24 bg-gradient-to-r from-purple-600 to-indigo-600 relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-800 shadow-md">
                  <QrCode size={32} className="text-zinc-700 dark:text-zinc-300" />
              </div>
          </div>

          <div className="pt-12 pb-8 px-6 text-center">
              <h3 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Conecte-se Conosco</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 px-4">
                  Aponte a câmera do celular para o QR Code abaixo para acessar nossos links, redes sociais e informações.
              </p>

              {/* QR Code Container */}
              <div className="bg-white p-4 rounded-2xl shadow-inner border border-zinc-100 inline-block mb-6">
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code OBPC" 
                    className="w-48 h-48 sm:w-64 sm:h-64 object-contain rounded-lg"
                  />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-bold text-sm rounded-xl transition-colors"
                  >
                      <Download size={18} /> Baixar
                  </button>
                  <button 
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-sm rounded-xl transition-colors"
                  >
                      {copied ? <Check size={18} /> : <Copy size={18} />} 
                      {copied ? 'Copiado' : 'Copiar Link'}
                  </button>
              </div>
          </div>
          
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 text-center border-t border-zinc-100 dark:border-zinc-700/50">
              <p className="text-xs text-zinc-400">
                  Mostre esta tela para novos visitantes.
              </p>
          </div>
      </div>
    </div>
  );
};
