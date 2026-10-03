import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { formatLocalDate } from "@/server/time";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Votre avis · X Detailing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: PageProps<"/avis/[token]"> ) {
  const { token } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { publicToken: token },
    select: {
      status: true, reference: true, scheduledStart: true,
      service: { select: { name: true } },
      operator: { select: { firstName: true } },
      review: { select: { rating: true } },
    },
  });

  if (!appointment) notFound();

  if (appointment.status !== "COMPLETED") {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-xl font-bold text-white">Prestation non terminée</h1>
        <p className="mt-2 text-sm text-chrome-400">
          Vous pourrez déposer votre avis une fois le lavage effectué.
        </p>
        <Link href={`/reservation/${token}`} className="mt-5 inline-block text-sm text-brand-400 underline">
          Voir ma réservation
        </Link>
      </div>
    );
  }

  if (appointment.review) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-xl font-bold text-white">Merci, c&apos;est noté</h1>
        <p className="mt-2 text-sm text-chrome-400">
          Vous avez déjà donné {appointment.review.rating}/5 pour cette prestation.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-brand-400">
        Votre avis
      </p>
      <h1 className="font-display mt-2 text-2xl font-extrabold tracking-tight text-white">
        Comment s&apos;est passé votre lavage&nbsp;?
      </h1>
      <p className="mt-1.5 text-sm text-chrome-400">
        {appointment.service.name} du {formatLocalDate(appointment.scheduledStart)}
        {appointment.operator && ` avec ${appointment.operator.firstName}`}
      </p>

      <ReviewForm
        token={token}
        operatorFirstName={appointment.operator?.firstName ?? null}
        googleReviewUrl={
          process.env.GOOGLE_REVIEW_URL?.trim()
            ? process.env.GOOGLE_REVIEW_URL.trim()
            : null
        }
      />
    </div>
  );
}
