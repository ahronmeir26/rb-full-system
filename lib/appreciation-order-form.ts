import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const INSTRUCTION_Y_FROM_TOP = 444.2;
const FORM_CODE_ROWS = [
  { pageIndex: 1, x: 147, yFromTop: 232.8 },
  { pageIndex: 2, x: 151, yFromTop: 225.3 },
] as const;

function cleanCouponCode(value: string) {
  const code = value.trim();
  if (!code) throw new Error("A coupon code is required to generate this form.");
  if (code.length > 64 || /[\r\n\u0000-\u001f\u007f]/.test(code)) {
    throw new Error("The coupon code contains unsupported characters.");
  }
  return code;
}

function fitText(font: PDFFont, text: string, preferredSize: number, maxWidth: number, minimumSize = 7) {
  const naturalWidth = font.widthOfTextAtSize(text, preferredSize);
  return naturalWidth <= maxWidth ? preferredSize : Math.max(minimumSize, preferredSize * maxWidth / naturalWidth);
}

function drawCouponCode(page: PDFPage, font: PDFFont, couponCode: string, x: number, yFromTop: number) {
  const fontSize = fitText(font, couponCode, 11, 118);
  page.drawText(couponCode, {
    x,
    y: page.getHeight() - yFromTop,
    size: fontSize,
    font,
    color: rgb(0.10, 0.13, 0.18),
  });
}

export async function customizeAppreciationOrderForm(template: Uint8Array, rawCouponCode: string) {
  const couponCode = cleanCouponCode(rawCouponCode);
  const pdf = await PDFDocument.load(template);
  const pages = pdf.getPages();
  if (pages.length < 3) throw new Error("The appreciation order-form template is incomplete.");

  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const instruction = `Use coupon code ${couponCode} at checkout.`;
  const instructionPage = pages[0];
  const instructionSize = fitText(boldFont, instruction, 9, 335);

  instructionPage.drawText(instruction, {
    x: 216,
    y: instructionPage.getHeight() - INSTRUCTION_Y_FROM_TOP,
    size: instructionSize,
    font: boldFont,
    color: rgb(0.10, 0.13, 0.18),
  });

  for (const row of FORM_CODE_ROWS) {
    drawCouponCode(pages[row.pageIndex], boldFont, couponCode, row.x, row.yFromTop);
  }

  pdf.setSubject(`A.I. Stone Appreciation Initiative order form - coupon code ${couponCode}`);
  pdf.setKeywords(["A.I. Stone", "Appreciation Initiative", "order form", `coupon:${couponCode}`]);
  return pdf.save();
}
