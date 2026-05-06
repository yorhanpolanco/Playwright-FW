import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();

export async function getAccessToken(scope: string): Promise<object> {
  const tokenResponse = await credential.getToken(scope);

  if (!tokenResponse) {
    throw new Error("No se pudo obtener el token");
  }

  const token={Authorization: `Bearer ${tokenResponse.token}` };

  return token;
}