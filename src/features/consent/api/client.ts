export type ConsentAccessDecision = {
  application?: {
    id: string;
    name: string;
    resourceIdentifier: string;
  };
  assignmentSource?: "direct" | "team";
  authorized: boolean;
  clientId: string;
  managed: boolean;
  reason?:
    | "assigned"
    | "client_disabled"
    | "application_disabled"
    | "principal_disabled"
    | "not_assigned"
    | "resource_mismatch";
};

export async function preflightConsent(search: string): Promise<ConsentAccessDecision> {
  const response = await fetch("/api/auth/oauth2/consent/preflight", {
    body: JSON.stringify({ oauth_query: buildSignedOAuthQuery(search) }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => undefined)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload) ?? "We could not verify access to this application.");
  }

  return payload as ConsentAccessDecision;
}

function buildSignedOAuthQuery(search: string) {
  const params = new URLSearchParams(search);
  if (!params.has("sig")) return undefined;

  const signedNames = new Set(params.getAll("ba_param"));
  if (signedNames.size === 0) return undefined;

  const signed = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === "sig" || key === "ba_param" || signedNames.has(key)) signed.append(key, value);
  }

  return signed.toString();
}

function readErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.error_description === "string") return record.error_description;
  if (typeof record.message === "string") return record.message;
  return undefined;
}
