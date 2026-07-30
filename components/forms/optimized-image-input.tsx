"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import styles from "./optimized-image-input.module.css";

type OptimizedFileInfo = {
  name: string;
  originalSize: number;
  optimizedSize: number;
  previewUrl: string;
};

type OptimizedImageInputProps = {
  name?: string;
  maxFiles?: number;
  targetKilobytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  required?: boolean;
  className?: string;
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_ORIGINAL_SIZE = 25 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    })} Mo`;
  }

  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("fr-FR")} Ko`;
}

function webpName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "vehicule";
  return `${base}.webp`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image-decode"));
    };
    image.src = url;
  });
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("image-encode"));
      },
      "image/webp",
      quality,
    );
  });
}

async function optimizeImage(
  file: File,
  targetBytes: number,
  maxWidth: number,
  maxHeight: number,
): Promise<File> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error("image-type");
  if (file.size > MAX_ORIGINAL_SIZE) throw new Error("image-original-size");

  const image = await loadImage(file);
  const initialScale = Math.min(
    1,
    maxWidth / image.naturalWidth,
    maxHeight / image.naturalHeight,
  );

  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
  let bestBlob: Blob | null = null;

  for (let resizePass = 0; resizePass < 5; resizePass += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("canvas");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.84, 0.78, 0.72, 0.66, 0.6, 0.54]) {
      const blob = await canvasBlob(canvas, quality);
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (blob.size <= targetBytes) {
        return new File([blob], webpName(file.name), {
          type: "image/webp",
          lastModified: Date.now(),
        });
      }
    }

    const nextWidth = Math.max(1, Math.round(width * 0.86));
    const nextHeight = Math.max(1, Math.round(height * 0.86));
    if (nextWidth < 900 && nextHeight < 500) break;
    width = nextWidth;
    height = nextHeight;
  }

  if (!bestBlob) throw new Error("image-encode");

  return new File([bestBlob], webpName(file.name), {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export function OptimizedImageInput({
  name = "images",
  maxFiles = 1,
  targetKilobytes = 800,
  maxWidth = 1920,
  maxHeight = 1080,
  required = false,
  className = "",
}: OptimizedImageInputProps) {
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const errorRef = useRef(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<OptimizedFileInfo[]>([]);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.closest("form");
    if (!form) return;

    const blockPendingSubmit = (event: SubmitEvent) => {
      if (processingRef.current || errorRef.current) {
        event.preventDefault();
        setError(
          processingRef.current
            ? "Attends la fin de l’optimisation avant d’enregistrer."
            : "Choisis de nouveau une image valide avant d’enregistrer.",
        );
      }
    };

    form.addEventListener("submit", blockPendingSubmit);
    return () => form.removeEventListener("submit", blockPendingSubmit);
  }, []);

  useEffect(() => {
    return () => {
      files.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    };
  }, [files]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = Array.from(input.files ?? []);

    files.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    setFiles([]);
    setError("");
    errorRef.current = false;

    if (selected.length === 0) return;
    if (selected.length > maxFiles) {
      input.value = "";
      errorRef.current = true;
      setError(
        maxFiles === 1
          ? "Une seule photo est autorisée par véhicule."
          : `Tu peux sélectionner au maximum ${maxFiles} photos.`,
      );
      return;
    }

    processingRef.current = true;
    setProcessing(true);

    try {
      const optimized = await Promise.all(
        selected.map((file) =>
          optimizeImage(
            file,
            targetKilobytes * 1024,
            maxWidth,
            maxHeight,
          ),
        ),
      );

      const transfer = new DataTransfer();
      optimized.forEach((file) => transfer.items.add(file));
      input.files = transfer.files;

      setFiles(
        optimized.map((file, index) => ({
          name: file.name,
          originalSize: selected[index].size,
          optimizedSize: file.size,
          previewUrl: URL.createObjectURL(file),
        })),
      );
    } catch (caught) {
      input.value = "";
      errorRef.current = true;
      const code = caught instanceof Error ? caught.message : "unknown";
      setError(
        code === "image-type"
          ? "Formats autorisés : JPG, PNG ou WEBP."
          : code === "image-original-size"
            ? "L’image d’origine dépasse 25 Mo."
            : "La compression de l’image a échoué. Essaie une autre capture.",
      );
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }

  return (
    <span className={`${styles.wrapper} ${className}`.trim()}>
      <input
        ref={inputRef}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={maxFiles > 1}
        required={required}
        onChange={handleChange}
        aria-describedby={helpId}
      />

      <span className={styles.help} id={helpId}>
        {maxFiles === 1 ? "1 photo maximum" : `${maxFiles} photos maximum`} · conversion
        automatique en WEBP · objectif {targetKilobytes} Ko par image.
      </span>

      <span className={styles.status} aria-live="polite">
        {processing && <span className={styles.processing}>Optimisation en cours…</span>}
        {error && <span className={styles.error}>{error}</span>}
        {!processing && !error && files.length > 0 && (
          <span className={styles.results}>
            {files.map((file) => {
              const saving = Math.max(
                0,
                Math.round((1 - file.optimizedSize / file.originalSize) * 100),
              );

              return (
                <span className={styles.result} key={file.previewUrl}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.previewUrl} alt="Aperçu optimisé" />
                  <span>
                    <strong>{file.name}</strong>
                    <span>
                      {formatBytes(file.originalSize)} → {formatBytes(file.optimizedSize)} · {saving}% économisés
                    </span>
                  </span>
                </span>
              );
            })}
          </span>
        )}
      </span>
    </span>
  );
}
