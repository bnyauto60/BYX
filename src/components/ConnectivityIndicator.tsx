"use client";

import { useEffect, useState } from "react";

/**
 * Petit point vert/rouge toujours visible, pour savoir immédiatement si
 * l'atelier est hors-ligne plutôt que de le découvrir après coup en
 * perdant une sauvegarde (amélioration demandée — fiabilité terrain).
 * À utiliser avec lib/offline/queue.ts pour la synchronisation réelle.
 */
export function ConnectivityIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" title={online ? "Connecté" : "Hors ligne — les saisies seront envoyées au retour du réseau"}>
      <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-safe" : "bg-danger"}`} />
      {online ? "En ligne" : "Hors ligne"}
    </span>
  );
}
