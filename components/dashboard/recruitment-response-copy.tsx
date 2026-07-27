"use client";

import { useMemo, useState } from "react";

type RecruitmentResponseCopyProps = {
  candidateName: string;
  position: string;
  status: string;
  interviewAt?: string | null;
  managerResponse?: string | null;
};

function defaultMessage({
  candidateName,
  position,
  status,
  interviewAt,
}: RecruitmentResponseCopyProps): string {
  if (status === "accepted") {
    return `Bonjour ${candidateName},\n\nAprès étude de ta candidature au poste de ${position}, nous avons le plaisir de t’annoncer qu’elle a été acceptée.\n\nLa direction de Nostra Group reviendra vers toi afin de finaliser ton intégration.\n\nBienvenue chez Nostra Group.`;
  }

  if (status === "refused") {
    return `Bonjour ${candidateName},\n\nNous te remercions pour ta candidature au poste de ${position}. Après étude de ton dossier, nous ne sommes malheureusement pas en mesure d’y donner une suite favorable pour le moment.\n\nNous te remercions pour l’intérêt porté à Nostra Group.`;
  }

  if (status === "interview") {
    const date = interviewAt
      ? new Date(interviewAt).toLocaleString("fr-FR")
      : "à définir avec la direction";
    return `Bonjour ${candidateName},\n\nTa candidature au poste de ${position} a retenu notre attention. Nous souhaitons te rencontrer pour un entretien prévu le ${date}.\n\nMerci de confirmer ta disponibilité auprès de la direction de Nostra Group.`;
  }

  return `Bonjour ${candidateName},\n\nTa candidature au poste de ${position} est actuellement en cours d’étude par la direction de Nostra Group. Nous reviendrons vers toi dès qu’une décision aura été prise.`;
}

export function RecruitmentResponseCopy(props: RecruitmentResponseCopyProps) {
  const [copied, setCopied] = useState(false);
  const message = useMemo(
    () => props.managerResponse?.trim() || defaultMessage(props),
    [
      props.candidateName,
      props.interviewAt,
      props.managerResponse,
      props.position,
      props.status,
    ],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <button type="button" className="secondary-button" onClick={copy}>
      {copied ? "Réponse copiée" : "Copier la réponse"}
    </button>
  );
}
