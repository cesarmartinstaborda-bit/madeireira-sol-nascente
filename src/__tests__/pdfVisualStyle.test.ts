import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  brandSeparator,
  drawFittedText,
  emptyCellMark,
  getBrandTableStyles,
  getPdfFontFamily,
  registerPdfFonts,
} from '../utils/pdfVisualStyle';

const novoDoc = () => new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

/** Simulates a packaged build where the bundled TTF cannot be parsed. */
const quebrarEmbedDeFonte = (doc: jsPDF) => {
  (doc as unknown as { addFont: () => never }).addFont = () => {
    throw new Error('TTF inválida');
  };
  return doc;
};

describe('incorporação de fonte nos PDFs', () => {
  it('usa Roboto quando a incorporação funciona', () => {
    const doc = novoDoc();
    expect(registerPdfFonts(doc)).toBe('Roboto');
    expect(getPdfFontFamily(doc)).toBe('Roboto');
    expect(brandSeparator(doc)).toBe('•');
    expect(emptyCellMark(doc)).toBe('—');
  });

  it('cai para uma fonte nativa do PDF em vez de ficar numa família inexistente', () => {
    const doc = quebrarEmbedDeFonte(novoDoc());
    expect(registerPdfFonts(doc)).toBe('helvetica');
    expect(getPdfFontFamily(doc)).toBe('helvetica');
    // The tables must follow the document, otherwise autoTable points at a
    // family jsPDF never registered — which is what blanks out the glyphs.
    expect(getBrandTableStyles(doc).styles.font).toBe('helvetica');
  });

  it('troca • e — por hífen no modo de fallback, pois as fontes nativas não os trazem', () => {
    const doc = quebrarEmbedDeFonte(novoDoc());
    registerPdfFonts(doc);
    expect(brandSeparator(doc)).toBe('-');
    expect(emptyCellMark(doc)).toBe('-');
  });
});

describe('drawFittedText', () => {
  const LONGO =
    'Madeireira e Transportes Sol Nascente do Paraná Ltda ME — Unidade Industrial de Ponta Grossa';

  it('nunca desenha além da largura informada', () => {
    const doc = novoDoc();
    registerPdfFonts(doc);
    const desenhadas: string[] = [];
    const original = doc.text.bind(doc);
    (doc as any).text = (text: string, ...rest: unknown[]) => {
      desenhadas.push(text);
      return (original as any)(text, ...rest);
    };

    drawFittedText(doc, LONGO, 16, 20, { maxWidth: 40, baseSize: 12, maxLines: 1 });

    expect(desenhadas).toHaveLength(1);
    expect(doc.getTextWidth(desenhadas[0])).toBeLessThanOrEqual(40);
    expect(desenhadas[0].endsWith('…')).toBe(true);
  });

  it('prefere reduzir o corpo a truncar o texto', () => {
    const doc = novoDoc();
    registerPdfFonts(doc);
    doc.setFontSize(12);
    const larguraOriginal = doc.getTextWidth('Madeireira Sol Nascente');

    drawFittedText(doc, 'Madeireira Sol Nascente', 16, 20, {
      maxWidth: larguraOriginal - 4,
      baseSize: 12,
      minSize: 8,
      maxLines: 1,
    });

    // Shrunk rather than cut: the full string still fits at the reduced size.
    expect(doc.getTextWidth('Madeireira Sol Nascente')).toBeLessThanOrEqual(larguraOriginal - 4);
  });

  it('devolve a altura consumida ao quebrar em várias linhas', () => {
    const doc = novoDoc();
    registerPdfFonts(doc);
    const altura = drawFittedText(doc, LONGO, 16, 20, {
      maxWidth: 45,
      baseSize: 11,
      minSize: 11,
      maxLines: 3,
      lineHeight: 5,
    });
    expect(altura).toBeGreaterThan(0);
  });
});
