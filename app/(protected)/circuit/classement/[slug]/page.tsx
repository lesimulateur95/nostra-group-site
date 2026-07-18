import { notFound } from "next/navigation";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";

const pages = {
  'f1': { slug: 'classement-f1', title: 'Classement F1', eyebrow: 'Classements', intro: 'Classement général officiel des pilotes du championnat F1.' },
  'ecuries': { slug: 'classement-ecuries', title: 'Classement des écuries', eyebrow: 'Classements', intro: 'Classement général officiel des écuries.' },
  'gt3rs': { slug: 'classement-gt3rs', title: 'Classement GT3 RS', eyebrow: 'Classements', intro: 'Classement général officiel du championnat Porsche GT3 RS.' },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
