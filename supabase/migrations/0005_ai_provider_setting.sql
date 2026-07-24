-- ============================================================================
-- BYX — Reglage du fournisseur IA par defaut, au niveau de l'atelier
-- Permet de choisir Claude (anthropic) ou ChatGPT (openai) depuis l'ecran
-- Parametres, sans redeploiement. 'auto' conserve le comportement actuel
-- (AI_DEFAULT_PROVIDER / AI_TASK_ROUTING cote serveur, voir lib/ai/router.ts).
-- ============================================================================

alter table workshops
  add column ai_provider text not null default 'auto';

  alter table workshops
    add constraint workshops_ai_provider_check
      check (ai_provider in ('auto', 'openai', 'anthropic'));
      
