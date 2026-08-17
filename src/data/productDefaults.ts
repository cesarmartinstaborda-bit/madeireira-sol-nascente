import { ProductDefault } from '../types';

export const INITIAL_PRODUCT_DEFAULTS: ProductDefault[] = [
  {
    id: 'prod-001',
    name: 'Eucalipto',
    defaultPricePerTon: 250.00,
    description: 'Madeira de reflorestamento Eucalipto - Padrão Klabin',
  },
  {
    id: 'prod-002',
    name: 'Pinus Taeda',
    defaultPricePerTon: 330.00,
    description: 'Pinus Taeda de alta densidade para celulose e papel',
  },
  {
    id: 'prod-003',
    name: 'Pinus Elliottii',
    defaultPricePerTon: 280.00,
    description: 'Pinus Elliottii para processamento industrial',
  },
  {
    id: 'prod-004',
    name: 'Tora Eucalipto',
    defaultPricePerTon: 290.00,
    description: 'Toras selecionadas de Eucalipto',
  },
  {
    id: 'prod-005',
    name: 'Cavaco de Madeira',
    defaultPricePerTon: 180.00,
    description: 'Biomassa e cavaco florestal limpo',
  },
];

export const getPriceForProduct = (productName: string, productCatalog: ProductDefault[]): number => {
  const found = productCatalog.find(
    (p) => p.name.toLowerCase().trim() === productName.toLowerCase().trim()
  );
  if (found) return found.defaultPricePerTon;
  if (productName.toLowerCase().includes('pinus')) return 330.00;
  return 250.00;
};
