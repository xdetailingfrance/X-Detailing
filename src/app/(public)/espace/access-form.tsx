"use client";

import { useActionState } from "react";
import { requestAccessLink } from "./actions";
import { Button, Field, Input } from "@/components/controls";

export function AccessLinkForm() {
  const [state, formAction, pending] = useActionState(requestAccessLink, null);

  if (state?.ok) {
    return (
      <div className="m-purple mt-8 rounded-[--radius-xd-lg] px-5 py-6">
        <p className="text-h3 text-xd-text">Vérifiez votre boîte mail</p>
        <p className="mt-2 text-body text-xd-text-2">
          Si un compte existe à cette adresse, vous venez de recevoir un lien d&apos;accès.
          Il est valable un quart d&apos;heure.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <Field label="Votre e-mail">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.fr"
        />
      </Field>

      {state && !state.ok && (
        <p className="text-meta text-xd-danger" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
        {pending ? "Envoi…" : "Recevoir mon lien d'accès"}
      </Button>
    </form>
  );
}
