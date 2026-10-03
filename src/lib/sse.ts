/**
 * Flux Server-Sent Events (§11, §33).
 *
 * Choisi plutôt qu'un WebSocket : le besoin est unidirectionnel — le serveur pousse des
 * positions, le client n'envoie rien — et SSE traverse les proxies sans négociation,
 * se reconnecte tout seul, et ne demande aucune infrastructure supplémentaire.
 */

export type SseOptions = {
  /** Intervalle entre deux envois, en millisecondes. */
  intervalMs: number;
  /** Appelé à chaque tick. Retourner `null` n'envoie rien ; `{ done: true }` ferme le flux. */
  tick: () => Promise<unknown | null>;
  /** Fermeture automatique après ce délai, pour ne pas laisser traîner un flux oublié. */
  maxDurationMs?: number;
  signal: AbortSignal;
};

/**
 * Durée maximale d'un flux.
 *
 * Sur un hébergeur serverless, une fonction est coupée au bout de quelques dizaines de
 * secondes : un flux qui viserait plus loin serait tranché en pleine phrase. On ferme
 * donc proprement avant la limite — `EventSource` se reconnecte seul, et la carte
 * continue de vivre sans que personne ne voie la couture.
 */
export const SSE_MAX_DURATION_MS = process.env.VERCEL ? 50_000 : 30 * 60_000;

export function sseResponse(options: SseOptions): Response {
  const encoder = new TextEncoder();
  const { intervalMs, tick, signal } = options;
  const maxDurationMs = Math.min(options.maxDurationMs ?? SSE_MAX_DURATION_MS, SSE_MAX_DURATION_MS);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearTimeout(deadline);
        try {
          controller.close();
        } catch {
          // Le flux peut déjà être fermé côté client : rien à faire.
        }
      };

      const push = async () => {
        if (closed) return;
        try {
          const payload = await tick();
          if (payload === null) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          close();
        }
      };

      signal.addEventListener("abort", close);
      const timer = setInterval(push, intervalMs);
      const deadline = setTimeout(close, maxDurationMs);

      // Premier envoi immédiat : le client ne doit pas attendre un tick pour voir l'état.
      await push();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Sans cela, nginx met le flux en tampon et rien n'arrive avant la fermeture.
      "X-Accel-Buffering": "no",
    },
  });
}
