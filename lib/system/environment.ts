export type NostraEnvironment =
  | "production"
  | "preproduction"
  | "preview"
  | "development";

function normalizeEnvironment(
  value: string | undefined,
): NostraEnvironment | null {
  const normalized = value
    ?.trim()
    .toLowerCase();

  if (
    normalized === "production" ||
    normalized === "prod"
  ) {
    return "production";
  }

  if (
    normalized === "preproduction" ||
    normalized === "preprod" ||
    normalized === "staging"
  ) {
    return "preproduction";
  }

  if (normalized === "preview") {
    return "preview";
  }

  if (
    normalized === "development" ||
    normalized === "dev"
  ) {
    return "development";
  }

  return null;
}

export type NostraEnvironmentState = {
  environment: NostraEnvironment;
  dataEnvironment: NostraEnvironment | null;
  vercelEnvironment: string;
  label: string;
  isProduction: boolean;
  isPreproduction: boolean;
  hasEnvironmentMismatch: boolean;
  branch: string;
  commitSha: string;
  shortCommitSha: string;
  deploymentUrl: string | null;
  deploymentId: string | null;
  releaseName: string;
};

export function getNostraEnvironment(): NostraEnvironmentState {
  const vercelEnvironment =
    process.env.VERCEL_ENV?.trim().toLowerCase() ??
    "development";

  const configuredEnvironment =
    normalizeEnvironment(
      process.env.NOSTRA_APP_ENV,
    );

  const environment =
    configuredEnvironment ??
    normalizeEnvironment(vercelEnvironment) ??
    "development";

  const dataEnvironment =
    normalizeEnvironment(
      process.env.NOSTRA_DATA_ENV,
    );

  const isProduction =
    environment === "production";
  const isPreproduction =
    environment === "preproduction" ||
    environment === "preview";

  const hasEnvironmentMismatch =
    Boolean(dataEnvironment) &&
    dataEnvironment !== environment &&
    !(
      environment === "preview" &&
      dataEnvironment === "preproduction"
    );

  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    "local";

  const branch =
    process.env.VERCEL_GIT_COMMIT_REF?.trim() ||
    process.env.GITHUB_REF_NAME?.trim() ||
    "local";

  const rawDeploymentUrl =
    process.env.VERCEL_URL?.trim();

  const deploymentUrl = rawDeploymentUrl
    ? rawDeploymentUrl.startsWith("http")
      ? rawDeploymentUrl
      : `https://${rawDeploymentUrl}`
    : null;

  const releaseName =
    process.env.NOSTRA_RELEASE?.trim() ||
    `${branch}-${commitSha.slice(0, 7)}`;

  const label =
    environment === "production"
      ? "PRODUCTION"
      : environment === "preproduction"
        ? "PRÉPRODUCTION"
        : environment === "preview"
          ? "APERÇU"
          : "DÉVELOPPEMENT";

  return {
    environment,
    dataEnvironment,
    vercelEnvironment,
    label,
    isProduction,
    isPreproduction,
    hasEnvironmentMismatch,
    branch,
    commitSha,
    shortCommitSha: commitSha.slice(0, 7),
    deploymentUrl,
    deploymentId:
      process.env.VERCEL_DEPLOYMENT_ID?.trim() ??
      null,
    releaseName,
  };
}
