"use client";

/**
 * Stratégie "local-first" pour l'atelier (réseau mobile souvent faible ou
 * absent, cf. cahier des charges §13 + amélioration demandée).
 *
 * Principe : toute création (événement, observation, preuve) est d'abord
 * écrite dans IndexedDB avec un client_uuid généré localement, puis une
 * tentative de synchronisation est faite immédiatement. En cas d'échec
 * réseau, l'élément reste en file et sera renvoyé au prochain retour de
 * connexion (écouteur 'online' + tentative périodique).
 *
 * Le client_uuid (colonnes technical_events.client_uuid,
 * observations.client_uuid) permet au serveur de dédupliquer si le même
 * élément est envoyé deux fois (ex : appareil qui recroit avoir échoué).
 *
 * Ce module est volontairement minimal pour le prototype : une implémentation
 * de production utiliserait idb (wrapper IndexedDB) et un Service Worker
 * pour continuer la synchronisation même app fermée.
 */

const DB_NAME = "byx-offline";
const STORE = "pending-writes";

export interface PendingWrite {
  client_uuid: string;
  kind: "technical_event" | "observation" | "evidence" | "measurement";
  payload: unknown;
  created_at: string;
  attempts: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "client_uuid" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueWrite(write: Omit<PendingWrite, "attempts" | "created_at">) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put({ ...write, attempts: 0, created_at: new Date().toISOString() });
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPendingWrites(): Promise<PendingWrite[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingWrite[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingWrite(client_uuid: string) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(client_uuid);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** À appeler au démarrage de l'app et sur l'événement 'online'. */
export async function flushPendingWrites(
  sender: (write: PendingWrite) => Promise<boolean>
) {
  const pending = await listPendingWrites();
  for (const write of pending) {
    try {
      const ok = await sender(write);
      if (ok) await removePendingWrite(write.client_uuid);
    } catch {
      // reste en file, retenté au prochain flush
    }
  }
}

export function watchConnectivity(onOnline: () => void) {
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
}
