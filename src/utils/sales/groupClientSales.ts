import { ClientRecord, VendaRecord } from '../../types';
import { sortByDateDescending } from '../dateSorting';

export function groupClientSales(baseList: VendaRecord[], vendaSearchTerm: string, clientes: ClientRecord[]) {
  const term = vendaSearchTerm.trim().toLowerCase();

  // Filter by search term if provided
  const filteredSales = term
    ? baseList.filter((v) => {
        const matchClient = (v.clientName || '').toLowerCase().includes(term);
        const matchProduct = (v.product || '').toLowerCase().includes(term);
        const matchDate = (v.date || '').includes(term);
        const matchNotes = (v.notes || '').toLowerCase().includes(term);
        const matchDriver = (v.driverPlate || '').toLowerCase().includes(term);
        return matchClient || matchProduct || matchDate || matchNotes || matchDriver;
      })
    : baseList;

  // Grouping map by client
  const groupsMap = new Map<
    string,
    {
      key: string;
      clientId: string;
      clientName: string;
      clientContact?: string;
      sales: VendaRecord[];
      totalQuantity: number;
      totalValue: number;
    }
  >();

  filteredSales.forEach((venda) => {
    // Find client record if exists to get authoritative name and contact
    const clientObj = clientes.find(
      (c) =>
        (venda.clientId && c.id === venda.clientId) ||
        (venda.clientName && c.name.trim().toLowerCase() === venda.clientName.trim().toLowerCase())
    );

    // Primary key: clientId, fallback to normalized client name
    const groupKey =
      venda.clientId?.trim() ||
      clientObj?.id ||
      `name_${(venda.clientName || '').trim().toLowerCase()}` ||
      'sem_cliente';
    const displayName = clientObj?.name || venda.clientName || 'Cliente Direto';

    let group = groupsMap.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        clientId: venda.clientId || clientObj?.id || '',
        clientName: displayName,
        clientContact: clientObj?.contact,
        sales: [],
        totalQuantity: 0,
        totalValue: 0,
      };
      groupsMap.set(groupKey, group);
    }

    group.sales.push(venda);
    group.totalQuantity += Number(venda.quantity) || 0;
    group.totalValue += Number(venda.totalValue) || 0;
  });

  const groupsArray = Array.from(groupsMap.values());

  // Sort sales inside each group by date descending
  groupsArray.forEach((g) => {
    g.sales = sortByDateDescending(g.sales, (sale) => sale.date, (sale) => sale.createdAt);
  });

  // Sort client groups:
  // In PENDING: by highest pending total value first, then client name
  // In PAID: by highest paid total value first, then client name
  groupsArray.sort((a, b) => {
    if (b.totalValue !== a.totalValue) {
      return b.totalValue - a.totalValue;
    }
    return a.clientName.localeCompare(b.clientName);
  });

  return groupsArray;
}
