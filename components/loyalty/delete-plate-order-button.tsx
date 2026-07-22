"use client";

type DeletePlateOrderButtonProps = {
  orderNumber: string;
  className?: string;
};

export function DeletePlateOrderButton({
  orderNumber,
  className,
}: DeletePlateOrderButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        const confirmed = window.confirm(
          `Supprimer définitivement la commande ${orderNumber} ?`,
        );

        if (!confirmed) event.preventDefault();
      }}
    >
      Supprimer la commande
    </button>
  );
}
