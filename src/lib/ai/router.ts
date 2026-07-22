import type {
  AIProvider,
  AITask,
  AITextRequest,
  AITextResponse,
  AIVideoAnalysisRequest,
  AIVideoAnalysisResponse
} from "./types";
import { mockProvider } from "./providers/mock";
import { openaiProvider } from "./providers/openai";
import { anthropicProvider } from "./providers/anthropic";

/**
 * Point d'entrée UNIQUE vers l'IA pour tout le reste de l'application.
 *
 * Aucune route API, aucun composant ne doit importer un provider directement.
 * Le choix du moteur (OpenAI, Claude, ou un futur modèle) se configure par
 * variables d'environnement, sans toucher au code applicatif :
 *
 *   AI_DEFAULT_PROVIDER=mock            -> provider par défaut
 *   AI_TASK_ROUTING={"diagnostic":"anthropic","video":"openai"}
 *      -> permet d'attribuer une tâche précise au provider le plus adapté
 *         (ex : Claude pour le raisonnement diagnostic, GPT-4o pour la vidéo).
 *
 * Ajouter un fournisseur : créer providers/<nom>.ts, l'enregistrer dans
 * `registry` ci-dessous. Rien d'autre à modifier.
 */

const registry: Record<string, AIProvider> = {
  mock: mockProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider
};

function getTaskRouting(): Partial<Record<AITask, string>> {
  try {
    return JSON.parse(process.env.AI_TASK_ROUTING ?? "{}");
  } catch {
    return {};
  }
}

function resolveProvider(task: AITask): AIProvider {
  const routing = getTaskRouting();
  const preferred = routing[task] ?? process.env.AI_DEFAULT_PROVIDER ?? "mock";
  const provider = registry[preferred];

  if (provider && provider.supports.includes(task)) return provider;

  // Repli : le provider préféré ne gère pas cette tâche -> cherche le premier
  // provider disponible qui la supporte, plutôt que de bloquer le mécanicien.
  const fallback = Object.values(registry).find((p) => p.supports.includes(task));
  if (fallback) return fallback;

  throw new Error(`Aucun provider IA disponible pour la tâche "${task}"`);
}

export async function runAITask(req: AITextRequest): Promise<AITextResponse> {
  const provider = resolveProvider(req.task);
  return provider.runText(req);
}

export async function runVideoAnalysis(req: AIVideoAnalysisRequest): Promise<AIVideoAnalysisResponse> {
  const routing = getTaskRouting();
  const preferred = routing.video ?? process.env.AI_DEFAULT_PROVIDER ?? "mock";
  let provider = registry[preferred];

  if (!provider?.runVideoAnalysis) {
    provider = Object.values(registry).find((p) => !!p.runVideoAnalysis);
  }
  if (!provider?.runVideoAnalysis) {
    throw new Error("Aucun provider IA ne supporte l'analyse vidéo actuellement");
  }
  return provider.runVideoAnalysis(req);
}

/** Utilisé par l'UI pour afficher si l'analyse temps réel est possible avec la config actuelle. */
export function isRealtimeVideoAvailable(): boolean {
  const routing = getTaskRouting();
  const preferred = routing.video ?? process.env.AI_DEFAULT_PROVIDER ?? "mock";
  return !!registry[preferred]?.supportsRealtime;
}
