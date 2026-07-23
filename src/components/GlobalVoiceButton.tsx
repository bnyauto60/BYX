"use client";

import { useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Bouton micro toujours visible en bas de l'écran, sur toutes les pages
 * (amélioration demandée). Le mécanicien dicte une intention courte
 * ("cherche AB123CD", "nouveau véhicule", "diagnostic") et l'app l'oriente
 * directement — sans devoir naviguer manuellement avec des mains sales.
 */
export function GlobalVoiceButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [supported] = useState(
    () => typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
  );
  const recognitionRef = useRef<any>(null);

  async function handleTranscript(text: string) {
    setFeedback(`« ${text} »`);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.action === "new_vehicle") {
        router.push("/vehicles/new");
      } else if (data.action === "new_diagnostic") {
        router.push("/diagnostic/new");
      } else if (data.action === "search_vehicle" && data.query) {
        router.push(`/vehicles?q=${encodeURIComponent(data.query)}`);
      } else {
        setFeedback(`Non compris : « ${text} »`);
        setTimeout(() => setFeedback(null), 3000);
        return;
      }
      setTimeout(() => setFeedback(null), 1500);
    } catch {
      setFeedback("Erreur de connexion");
      setTimeout(() => setFeedback(null), 2000);
    }
  }

  function start() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => handleTranscript(event.results[0][0].transcript);
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

  if (!supported || pathname === "/login") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {feedback && (
        <div className="card py-2 px-3 text-sm max-w-xs shadow-lg">{feedback}</div>
      )}
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-label="Commande vocale"
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors ${
          listening ? "bg-danger text-white animate-pulse" : "bg-accent text-base"
        }`}
      >
        🎙️
      </button>
    </div>
  );
}
