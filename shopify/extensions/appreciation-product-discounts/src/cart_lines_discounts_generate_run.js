// @ts-check

function candidateValue(discount) {
  const value = Number(discount?.value || 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (discount?.type === "fixed_amount") {
    return { fixedAmount: { amount: value.toFixed(2), appliesToEachItem: true } };
  }
  return { percentage: { value: Math.min(value, 100).toFixed(2) } };
}

function candidate(message, lines, discount) {
  const value = candidateValue(discount);
  if (!value || !lines.length) return null;
  return {
    message,
    targets: lines.map((line) => ({ cartLine: { id: line.id } })),
    value,
  };
}

/**
 * Applies the independently configured men's and boys' product discounts.
 *
 * @param {any} input
 * @returns {{operations: Array<any>}}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const configuration = input?.discount?.metafield?.jsonValue || {};
  const cartLines = input?.cart?.lines || [];
  const mensLines = cartLines.filter((line) =>
    line?.merchandise?.__typename === "ProductVariant" &&
    line.merchandise.inMensCollection
  );
  const boysLines = cartLines.filter((line) =>
    line?.merchandise?.__typename === "ProductVariant" &&
    line.merchandise.inBoysCollection
  );
  const candidates = [
    candidate("2026 Appreciation men's preorder discount", mensLines, configuration.mensDiscount),
    candidate("2026 Appreciation boys' preorder discount", boysLines, configuration.boysDiscount),
  ].filter(Boolean);

  if (!candidates.length) return { operations: [] };
  return {
    operations: [{
      productDiscountsAdd: {
        candidates,
        selectionStrategy: "ALL",
      },
    }],
  };
}
