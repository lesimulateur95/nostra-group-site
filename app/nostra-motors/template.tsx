import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

// Le template V41 ne doit rien injecter automatiquement dans les pages publiques.
export default function NostraMotorsTemplate({ children }: Props) {
  return children;
}
