"use client";

import { useRef, useState } from "react";

/**
 * Dictée vocale (cahier des charges §8.3). Utilise la Web Speech API du
 * navigateur (disponible sur Chrome mobile/desktop, principal navigateur en
 * atelier). Le texte brut est transmis au parent, qui l'envoie ensuite à
 * /api/ai/structure pour extraction structurée — la reconnaissance vocale
 * elle-même n'est pas un point de dépendance à un fournisseur IA.
 */
export function VoiceDictation({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(
    () => typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
  );
  const recognitionRef = useRef<any>(null);

  function start() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (!supported) {
    return <p className="text-xs text-muted">Dictée vocale non disponible sur ce navigateur — utilisez la saisie texte.</p>;
  }

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`btn ${listening ? "bg-danger text-white" : "btn-secondary"}`}
    >
      {listening ? "● Enregistrement… (appuyer pour arrêter)" : "🎙️ Dicter une observation"}
    </button>
  );
}
