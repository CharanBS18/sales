/**
 * AWS S3 helpers — server-only. Uses the Lovable connector gateway to mint
 * short-lived signed URLs. Never expose direct S3 URLs to the client.
 */

const GATEWAY = "https://connector-gateway.lovable.dev";

function authHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const s3Key = process.env.AWS_S3_API_KEY;
  if (!lovableKey || !s3Key) {
    throw new Error("S3 connector not configured");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": s3Key,
    "Content-Type": "application/json",
  };
}

export async function s3SignedReadUrl(objectKey: string): Promise<string> {
  const res = await fetch(
    `${GATEWAY}/api/v1/sign_storage_url?provider=aws_s3&mode=read`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ object_path: objectKey }),
    },
  );
  if (!res.ok) {
    throw new Error(`S3 sign-read failed [${res.status}]: ${await res.text()}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

export async function s3SignedWriteUrl(objectKey: string): Promise<{
  url: string;
  method: string;
}> {
  const res = await fetch(
    `${GATEWAY}/api/v1/sign_storage_url?provider=aws_s3&mode=write`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ object_path: objectKey }),
    },
  );
  if (!res.ok) {
    throw new Error(`S3 sign-write failed [${res.status}]: ${await res.text()}`);
  }
  const data = (await res.json()) as { url: string; method?: string };
  return { url: data.url, method: data.method ?? "PUT" };
}
