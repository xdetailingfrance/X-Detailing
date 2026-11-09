"use client";

// L'impression du navigateur fait le PDF : « Enregistrer au format PDF »
// dans la boîte d'impression. Pas de bibliothèque à embarquer, et le
// document reste sélectionnable et lisible par un lecteur d'écran.
export default function BoutonImprimer() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
    >
      Imprimer / enregistrer en PDF
    </button>
  );
}
