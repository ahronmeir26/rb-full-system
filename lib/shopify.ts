import type { DiscountProgram } from "./types";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const CONFIG_NAMESPACE = "$app:appreciation-product-discounts";
const CONFIG_KEY = "function-configuration";

type ShopifyUserError = {
  field?: string[];
  message: string;
};

type ShopifyCode = {
  id: string;
  code: string;
};

export type ShopifyCollection = {
  id: string;
  title: string;
  handle: string;
};

export function shopifyConnectionStatus() {
  const store = (process.env.SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
  const functionId = process.env.SHOPIFY_DISCOUNT_FUNCTION_ID || "";
  return {
    store,
    connected: Boolean(store && token),
    functionConfigured: Boolean(functionId),
  };
}

async function shopifyGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { store, connected } = shopifyConnectionStatus();
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
  if (!connected) throw new Error("Shopify is not connected. Add the store domain and Admin API access token.");

  const response = await fetch(`https://${store}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-access-token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json().catch(() => null) as {
    data?: T;
    errors?: Array<{ message: string }>;
  } | null;
  if (!response.ok || !result) throw new Error(`Shopify returned HTTP ${response.status}.`);
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join(" "));
  if (!result.data) throw new Error("Shopify returned an empty response.");
  return result.data;
}

function throwUserErrors(errors?: ShopifyUserError[]) {
  if (errors?.length) throw new Error(errors.map((error) => error.message).join(" "));
}

export async function listShopifyCollections(search = ""): Promise<ShopifyCollection[]> {
  const query = `#graphql
    query AppreciationCollections($query: String) {
      collections(first: 100, query: $query, sortKey: TITLE) {
        nodes { id title handle }
      }
    }`;
  const data = await shopifyGraphql<{ collections: { nodes: ShopifyCollection[] } }>(
    query,
    { query: search.trim() || null },
  );
  return data.collections.nodes;
}

function functionConfiguration(program: DiscountProgram) {
  return {
    mensCollectionIds: [program.mensCollectionId],
    boysCollectionIds: [program.boysCollectionId],
    mensDiscount: {
      type: program.mensDiscountType,
      value: program.mensDiscountValue,
    },
    boysDiscount: {
      type: program.boysDiscountType,
      value: program.boysDiscountValue,
    },
  };
}

function discountInput(program: DiscountProgram, includeFunctionId: boolean) {
  const input: Record<string, unknown> = {
    code: program.mainCode,
    title: program.title,
    appliesOncePerCustomer: program.appliesOncePerCustomer,
    combinesWith: {
      orderDiscounts: program.combinesWithOrderDiscounts,
      productDiscounts: program.combinesWithProductDiscounts,
      shippingDiscounts: program.combinesWithShippingDiscounts,
    },
    startsAt: program.startsAt || new Date().toISOString(),
    endsAt: program.endsAt || null,
    usageLimit: program.usageLimit,
    metafields: [{
      namespace: CONFIG_NAMESPACE,
      key: CONFIG_KEY,
      type: "json",
      value: JSON.stringify(functionConfiguration(program)),
    }],
  };
  if (includeFunctionId) input.functionId = process.env.SHOPIFY_DISCOUNT_FUNCTION_ID;
  return input;
}

async function createDiscount(program: DiscountProgram) {
  const functionId = process.env.SHOPIFY_DISCOUNT_FUNCTION_ID;
  if (!functionId) throw new Error("The Shopify Discount Function ID has not been configured.");
  const mutation = `#graphql
    mutation CreateAppreciationDiscount($input: DiscountCodeAppInput!) {
      discountCodeAppCreate(codeAppDiscount: $input) {
        codeAppDiscount { discountId status }
        userErrors { field message }
      }
    }`;
  const data = await shopifyGraphql<{
    discountCodeAppCreate: {
      codeAppDiscount: { discountId: string; status: string } | null;
      userErrors: ShopifyUserError[];
    };
  }>(mutation, { input: discountInput(program, true) });
  throwUserErrors(data.discountCodeAppCreate.userErrors);
  if (!data.discountCodeAppCreate.codeAppDiscount) throw new Error("Shopify did not create the discount.");
  return data.discountCodeAppCreate.codeAppDiscount;
}

async function updateDiscount(program: DiscountProgram) {
  const mutation = `#graphql
    mutation UpdateAppreciationDiscount($id: ID!, $input: DiscountCodeAppInput!) {
      discountCodeAppUpdate(id: $id, codeAppDiscount: $input) {
        codeAppDiscount { discountId status }
        userErrors { field message }
      }
    }`;
  const data = await shopifyGraphql<{
    discountCodeAppUpdate: {
      codeAppDiscount: { discountId: string; status: string } | null;
      userErrors: ShopifyUserError[];
    };
  }>(mutation, { id: program.shopifyDiscountId, input: discountInput(program, false) });
  throwUserErrors(data.discountCodeAppUpdate.userErrors);
  if (!data.discountCodeAppUpdate.codeAppDiscount) throw new Error("Shopify did not update the discount.");
  return data.discountCodeAppUpdate.codeAppDiscount;
}

async function setDiscountActive(discountId: string, active: boolean) {
  const mutation = active
    ? `#graphql
        mutation ActivateAppreciationDiscount($id: ID!) {
          discountCodeActivate(id: $id) {
            codeDiscountNode { id }
            userErrors { field message }
          }
        }`
    : `#graphql
        mutation DeactivateAppreciationDiscount($id: ID!) {
          discountCodeDeactivate(id: $id) {
            codeDiscountNode { id }
            userErrors { field message }
          }
        }`;
  const field = active ? "discountCodeActivate" : "discountCodeDeactivate";
  const data = await shopifyGraphql<Record<string, { userErrors: ShopifyUserError[] }>>(mutation, { id: discountId });
  throwUserErrors(data[field]?.userErrors);
}

async function loadDiscountCodes(discountId: string) {
  const codes: ShopifyCode[] = [];
  let after: string | null = null;
  do {
    const query = `#graphql
      query AppreciationDiscountCodes($id: ID!, $after: String) {
        codeDiscountNode(id: $id) {
          codeDiscount {
            ... on DiscountCodeApp {
              status
              codes(first: 250, after: $after) {
                nodes { id code }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }
      }`;
    const data: {
      codeDiscountNode: {
        codeDiscount: {
          status: string;
          codes: {
            nodes: ShopifyCode[];
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        } | null;
      } | null;
    } = await shopifyGraphql(query, { id: discountId, after });
    const discount = data.codeDiscountNode?.codeDiscount;
    if (!discount) throw new Error("The configured Shopify discount could not be found.");
    codes.push(...discount.codes.nodes);
    after = discount.codes.pageInfo.hasNextPage ? discount.codes.pageInfo.endCursor : null;
  } while (after);
  return codes;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function addCodes(discountId: string, codes: string[]) {
  const jobs: string[] = [];
  const mutation = `#graphql
    mutation AddAppreciationCodes($discountId: ID!, $codes: [DiscountRedeemCodeInput!]!) {
      discountRedeemCodeBulkAdd(discountId: $discountId, codes: $codes) {
        bulkCreation { id }
        userErrors { field message }
      }
    }`;
  for (const batch of chunks(codes, 250)) {
    const data = await shopifyGraphql<{
      discountRedeemCodeBulkAdd: {
        bulkCreation: { id: string } | null;
        userErrors: ShopifyUserError[];
      };
    }>(mutation, { discountId, codes: batch.map((code) => ({ code })) });
    throwUserErrors(data.discountRedeemCodeBulkAdd.userErrors);
    if (data.discountRedeemCodeBulkAdd.bulkCreation?.id) jobs.push(data.discountRedeemCodeBulkAdd.bulkCreation.id);
  }
  return jobs;
}

async function deleteCodes(discountId: string, ids: string[]) {
  const jobs: string[] = [];
  const mutation = `#graphql
    mutation RemoveAppreciationCodes($discountId: ID!, $ids: [ID!]) {
      discountCodeRedeemCodeBulkDelete(discountId: $discountId, ids: $ids) {
        job { id }
        userErrors { field message }
      }
    }`;
  for (const batch of chunks(ids, 250)) {
    const data = await shopifyGraphql<{
      discountCodeRedeemCodeBulkDelete: {
        job: { id: string } | null;
        userErrors: ShopifyUserError[];
      };
    }>(mutation, { discountId, ids: batch });
    throwUserErrors(data.discountCodeRedeemCodeBulkDelete.userErrors);
    if (data.discountCodeRedeemCodeBulkDelete.job?.id) jobs.push(data.discountCodeRedeemCodeBulkDelete.job.id);
  }
  return jobs;
}

export async function syncShopifyDiscount(program: DiscountProgram, schoolCodes: string[]) {
  if (!program.mainCode) throw new Error("Enter a main 2026 discount code before syncing.");
  if (!program.mensCollectionId || !program.boysCollectionId) throw new Error("Choose both Shopify product collections before syncing.");
  if (program.mensCollectionId === program.boysCollectionId) throw new Error("Men's and boys' shirts must use different Shopify collections.");
  if (program.mensDiscountValue <= 0 || program.boysDiscountValue <= 0) throw new Error("Enter a discount greater than zero for both product groups.");

  const normalizedSchoolCodes = schoolCodes.map((code) => code.trim().toUpperCase()).filter(Boolean);
  const desiredCodes = [...new Set([program.mainCode.toUpperCase(), ...normalizedSchoolCodes])];
  if (desiredCodes.length !== normalizedSchoolCodes.length + 1) {
    throw new Error("The main code and every school code must be unique.");
  }

  const discount = program.shopifyDiscountId ? await updateDiscount(program) : await createDiscount(program);
  const existingCodes = await loadDiscountCodes(discount.discountId);
  const desiredSet = new Set(desiredCodes);
  const existingSet = new Set(existingCodes.map((item) => item.code.toUpperCase()));
  const codesToAdd = desiredCodes.filter((code) => !existingSet.has(code));
  const codeIdsToDelete = existingCodes.filter((item) => !desiredSet.has(item.code.toUpperCase())).map((item) => item.id);
  const [addJobIds, deleteJobIds] = await Promise.all([
    addCodes(discount.discountId, codesToAdd),
    deleteCodes(discount.discountId, codeIdsToDelete),
  ]);
  await setDiscountActive(discount.discountId, program.active);

  return {
    discountId: discount.discountId,
    shopifyStatus: program.active ? "ACTIVE" : "DISABLED",
    existingCodes,
    codesToAdd,
    codeIdsToDelete,
    jobIds: [...addJobIds, ...deleteJobIds],
    totalDesiredCodes: desiredCodes.length,
  };
}
