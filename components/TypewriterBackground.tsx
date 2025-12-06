
import React, { useState, useEffect } from 'react';

const PHRASES = [
  { text: "Sejam sempre dedicados a obra do Senhor", highlight: "Senhor" },
  { text: "O maior entre vocês deverá ser servo", highlight: "servo" },
  { text: "E tudo quanto fizerem, façam com amor", highlight: "amor" }
];

export const TypewriterBackground: React.FC = () => {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentTextLength, setCurrentTextLength] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const currentPhraseObj = PHRASES[currentPhraseIndex];
    const fullText = currentPhraseObj.text;

    // Velocidade de digitação e exclusão
    const typeSpeed = 100; // ms por letra
    const deleteSpeed = 50; // ms por letra (mais rápido para apagar)
    const pauseTime = 2000; // 2 segundos de leitura

    if (isPaused) return;

    const handleType = () => {
      if (!isDeleting) {
        // Digitando
        if (currentTextLength < fullText.length) {
          setCurrentTextLength((prev) => prev + 1);
        } else {
          // Terminou de digitar, pausa para leitura
          setIsPaused(true);
          setTimeout(() => {
            setIsPaused(false);
            setIsDeleting(true);
          }, pauseTime);
        }
      } else {
        // Apagando (Backspace)
        if (currentTextLength > 0) {
          setCurrentTextLength((prev) => prev - 1);
        } else {
          // Terminou de apagar, vai para a próxima frase
          setIsDeleting(false);
          setCurrentPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        }
      }
    };

    const timer = setTimeout(handleType, isDeleting ? deleteSpeed : typeSpeed);

    return () => clearTimeout(timer);
  }, [currentTextLength, isDeleting, isPaused, currentPhraseIndex]);

  // Lógica de Renderização com Highlight
  const renderText = () => {
    const currentPhraseObj = PHRASES[currentPhraseIndex];
    const fullText = currentPhraseObj.text;
    const highlightWord = currentPhraseObj.highlight;

    // Texto cortado no tamanho atual
    const visibleText = fullText.substring(0, currentTextLength);

    // Se não tiver highlight ou a palavra highlight não estiver visível ainda, retorna normal
    const highlightIndex = fullText.indexOf(highlightWord);
    
    if (highlightIndex === -1 || currentTextLength <= highlightIndex) {
      return <span className="text-zinc-400">{visibleText}</span>;
    }

    // Separa as partes: Antes do highlight, O highlight (parcial ou total), Depois do highlight
    const partBefore = fullText.substring(0, highlightIndex);
    
    // Calcula quanto do highlight está visível
    const highlightEndIndex = highlightIndex + highlightWord.length;
    const visibleHighlightLength = Math.min(currentTextLength, highlightEndIndex) - highlightIndex;
    const partHighlight = highlightWord.substring(0, visibleHighlightLength);

    // Calcula o texto após o highlight (se houver)
    let partAfter = "";
    if (currentTextLength > highlightEndIndex) {
      partAfter = fullText.substring(highlightEndIndex, currentTextLength);
    }

    return (
      <>
        <span className="text-zinc-400">{partBefore}</span>
        <span className="text-orange-500 font-bold">{partHighlight}</span>
        <span className="text-zinc-400">{partAfter}</span>
      </>
    );
  };

  return (
    <div className="w-full text-center py-6 pointer-events-none select-none flex justify-center">
      <div className="max-w-md px-4">
        <h1 className="font-sans font-medium text-sm md:text-base leading-tight tracking-wide min-h-[1.5em]">
          {renderText()}
          <span className="animate-pulse text-orange-500 ml-0.5 font-bold">|</span>
        </h1>
      </div>
    </div>
  );
};
