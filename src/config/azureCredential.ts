import { DefaultAzureCredential, useIdentityPlugin } from '@azure/identity';
import { vsCodePlugin } from '@azure/identity-vscode';

useIdentityPlugin(vsCodePlugin);

export const azureCredential = new DefaultAzureCredential({
  tenantId: process.env.AZURE_TENANT_ID,
});
