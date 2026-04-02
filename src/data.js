import { addDays, subDays, addWeeks, addMonths } from 'date-fns';

export const initialProducts = [
  { 
    id: 1, 
    name: 'Gestão de Redes Sociais', 
    defaultPrice: 1500, 
    costs: [{ id: 1, description: 'Designer', value: 250 }, { id: 2, description: 'Taxa Boleto', value: 2 }]
  },
  { 
    id: 2, 
    name: 'Gestão de Tráfego', 
    defaultPrice: 1200, 
    costs: [{ id: 3, description: 'Gestor Auxiliar', value: 200 }]
  },
  { 
    id: 3, 
    name: 'Pack de Artes (Semanal)', 
    defaultPrice: 375, 
    costs: [{ id: 4, description: 'Designer', value: 50 }, { id: 5, description: 'Taxa Pix', value: 1 }]
  }
];

export const initialClients = [
  { 
    id: 1, 
    name: 'Dona Maria Pratinhos', 
    frequency: 'Semanal', 
    productId: 3,
    phone: '5585999999999',
    value: 375, 
    startDate: subDays(new Date(), 30),
    endDate: addDays(new Date(), 30)
  },
  { 
    id: 2, 
    name: 'Bendito Nordestino', 
    frequency: 'Quinzenal', 
    productId: 1,
    phone: '5585988888888',
    value: 750, 
    startDate: subDays(new Date(), 60),
    endDate: addDays(new Date(), 60)
  },
  { 
    id: 3, 
    name: 'Pastel da Hora', 
    frequency: 'Mensal', 
    productId: 2,
    phone: '5585977777777',
    value: 1500, 
    startDate: subDays(new Date(), 90),
    endDate: addDays(new Date(), 10)
  },
  { 
    id: 4, 
    name: '75 Burger', 
    frequency: 'Quinzenal', 
    productId: 1,
    phone: '5585966666666',
    value: 550, 
    startDate: subDays(new Date(), 120),
    endDate: addDays(new Date(), 30)
  },
  { 
    id: 5, 
    name: 'Sushi Império', 
    frequency: 'Semanal', 
    productId: 3,
    phone: '5585955555555',
    value: 400, 
    startDate: subDays(new Date(), 14),
    endDate: addDays(new Date(), 90)
  },
];

export const initialInvoices = [
  { id: 101, clientId: 1, dueDate: subDays(new Date(), 12), value: 375, cost: 51, status: 'Pago', paidDate: subDays(new Date(), 12) },
  { id: 102, clientId: 1, dueDate: subDays(new Date(), 5), value: 375, cost: 51, status: 'Pago', paidDate: subDays(new Date(), 4) },
  { id: 103, clientId: 1, dueDate: addDays(new Date(), 2), value: 375, cost: 51, status: 'Aguardando', paidDate: null },
  { id: 104, clientId: 2, dueDate: subDays(new Date(), 9), value: 750, cost: 252, status: 'Pago', paidDate: subDays(new Date(), 8) },
  { id: 105, clientId: 2, dueDate: addDays(new Date(), 5), value: 750, cost: 252, status: 'Aguardando', paidDate: null },
  { id: 106, clientId: 4, dueDate: subDays(new Date(), 3), value: 550, cost: 252, status: 'Pendente', paidDate: null },
  { id: 107, clientId: 5, dueDate: subDays(new Date(), 6), value: 400, cost: 51, status: 'Pago', paidDate: subDays(new Date(), 6) },
  { id: 108, clientId: 5, dueDate: addDays(new Date(), 1), value: 400, cost: 51, status: 'Aguardando', paidDate: null },
];
