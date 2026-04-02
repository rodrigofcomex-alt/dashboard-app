import React, { useState, useEffect } from 'react';
import { initialClients, initialInvoices, initialProducts } from './data';
import { format, isPast, isToday, addDays, addMonths, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LayoutDashboard, Users, Receipt, TrendingUp, AlertCircle, 
  CheckCircle2, Clock, Plus, Package, MessageCircle, 
  Trash2, Edit2, Minus, ChevronLeft, Eye, LogOut
} from 'lucide-react';
import './App.css';

// Firebase Integrations
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
};

const formatDate = (date) => {
  if (!date) return '';
  return format(typeof date === 'string' ? new Date(date) : date, "dd 'de' MMM", { locale: ptBR });
};

// Obter custo total de uma lista de custos do produto
const getTotalCost = (costs = []) => costs.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

// --- Utils ---
const generateInvoicesForClient = (client, productTotalCost) => {
  const newInvoices = [];
  let currentDate = typeof client.startDate === 'string' ? new Date(client.startDate) : client.startDate;
  const end = typeof client.endDate === 'string' ? new Date(client.endDate) : client.endDate;
  const limitDate = new Date(); 
  const actualEnd = limitDate > end ? end : limitDate; 
  actualEnd.setMonth(actualEnd.getMonth() + 3);
  const cutoff = actualEnd < end ? actualEnd : end;

  let costPerInvoice = Number(productTotalCost);
  if (client.frequency === 'Semanal') costPerInvoice = Number(productTotalCost) / 4;
  else if (client.frequency === 'Quinzenal') costPerInvoice = Number(productTotalCost) / 2;

  let invoiceCount = 0;
  while (isBefore(currentDate, cutoff) && invoiceCount < 50) {
    newInvoices.push({
      clientId: String(client.id),
      dueDate: new Date(currentDate).toISOString(),
      value: Number(client.value),
      cost: costPerInvoice,
      status: 'Aguardando',
      paidDate: null
    });

    if (client.frequency === 'Semanal') currentDate = addDays(currentDate, 7);
    else if (client.frequency === 'Quinzenal') currentDate = addDays(currentDate, 15);
    else if (client.frequency === 'Mensal') currentDate = addMonths(currentDate, 1);
    else break;
    
    invoiceCount++;
  }
  return newInvoices;
};

// --- Shared Components ---

const InvoicesTableComponent = ({ invoices, clients }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const handleMarkAsPaid = async (id) => {
    await updateDoc(doc(db, 'invoices', String(id)), { 
      status: 'Pago', 
      paidDate: new Date().toISOString() 
    });
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'invoices', String(id)));
  };

  const startEditing = (inv) => {
    setEditingId(inv.id);
    setEditData({ value: inv.value, cost: inv.cost, dueDate: format(new Date(inv.dueDate), 'yyyy-MM-dd') });
  };

  const saveEdit = async (id) => {
    await updateDoc(doc(db, 'invoices', String(id)), {
      value: Number(editData.value), 
      cost: Number(editData.cost), 
      dueDate: new Date(editData.dueDate).toISOString()
    });
    setEditingId(null);
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Vencimento</th>
            <th>Valor (R$)</th>
            <th>Custo (R$)</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {[...invoices].sort((a,b) => new Date(b.dueDate) - new Date(a.dueDate)).map(inv => {
            const client = clients.find(c => String(c.id) === String(inv.clientId));
            const isLate = isPast(new Date(inv.dueDate)) && !isToday(new Date(inv.dueDate)) && inv.status !== 'Pago';
            const statusBadge = inv.status === 'Pago' ? 'success' : isLate ? 'danger' : 'warning';
            const statusText = inv.status === 'Pago' ? 'Pago' : isLate ? 'Atrasado' : 'Pendente';

            if (String(editingId) === String(inv.id)) {
              return (
                <tr key={inv.id}>
                  <td colSpan="2">
                    <input type="date" className="form-input" value={editData.dueDate} onChange={e => setEditData({...editData, dueDate: e.target.value})} style={{padding: '8px'}} />
                  </td>
                  <td>
                    <input type="number" className="form-input" value={editData.value} onChange={e => setEditData({...editData, value: e.target.value})} style={{padding: '8px', maxWidth: '100px'}} />
                  </td>
                  <td>
                    <input type="number" className="form-input" value={editData.cost} onChange={e => setEditData({...editData, cost: e.target.value})} style={{padding: '8px', maxWidth: '100px'}} />
                  </td>
                  <td>
                    <button className="btn success" onClick={() => saveEdit(inv.id)} style={{marginRight: '8px', padding: '6px 12px', fontSize: '0.75rem'}}>Salvar</button>
                    <button className="btn btn-secondary" onClick={() => setEditingId(null)} style={{padding: '6px 12px', fontSize: '0.75rem'}}>Canc</button>
                  </td>
                </tr>
              )
            }

            return (
              <tr key={inv.id}>
                <td>
                  {client ? (
                    <div className="client-name">
                      <div className="client-avatar" style={{width: '28px', height: '28px', fontSize: '0.7rem'}}>{client.name.charAt(0)}</div>
                      <div style={{display:'flex', flexDirection: 'column'}}>
                         <span>{client.name}</span>
                         <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{client.frequency}</span>
                      </div>
                    </div>
                  ) : <span style={{color: 'var(--text-muted)'}}>Cliente apagado</span>}
                </td>
                <td>{formatDate(inv.dueDate)}</td>
                <td style={{fontWeight: 600}}>{formatCurrency(inv.value)}</td>
                <td style={{color: 'var(--text-muted)'}}>{formatCurrency(inv.cost || 0)}</td>
                <td>
                  <span className={`badge ${statusBadge}`}>{statusText}</span>
                </td>
                <td style={{display: 'flex', gap: '8px'}}>
                  {inv.status !== 'Pago' && (
                    <button 
                      className="btn" 
                      style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: '#34d399', color: '#064e3b' }}
                      onClick={() => handleMarkAsPaid(inv.id)}
                    >
                      Dar Baixa
                    </button>
                  )}
                  <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.75rem' }} onClick={() => startEditing(inv)}>
                     <Edit2 size={14} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--danger)' }} onClick={() => handleDelete(inv.id)}>
                     <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
          {invoices.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>Nenhuma cobrança encontrada.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};


// --- Layouts ---

const Sidebar = ({ activeTab, setActiveTab, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Lançamentos', icon: Receipt },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'products', label: 'Produtos', icon: Package },
  ];

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
      <div>
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px'}}>E</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Emphasis</h2>
        </div>

        <ul className="nav-menu">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id} className="nav-item">
                <a 
                  className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={20} />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
         <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', color: 'var(--danger)', border: 'none', background: 'transparent' }} onClick={onLogout}>
            <LogOut size={18} /> Sair do Sistema
         </button>
      </div>
    </aside>
  );
};

const Dashboard = ({ clients, invoices }) => {
  const expectedRevenue = invoices.filter(i => i.status !== 'Cancelado').reduce((acc, curr) => acc + curr.value, 0);
  const actualRevenue = invoices.filter(i => i.status === 'Pago').reduce((acc, curr) => acc + curr.value, 0);
  
  const realizedCosts = invoices.filter(i => i.status === 'Pago').reduce((acc, curr) => acc + (curr.cost || 0), 0);
  const realizedProfit = actualRevenue - realizedCosts;

  const upcomingInvoices = invoices
    .filter(i => i.status !== 'Pago')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <div className="fade-in">
      <div className="top-header">
        <h1>Visão Geral do <span>Caixa</span></h1>
      </div>

      <div className="grid-cards">
        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span className="stat-title">Faturamento Emitido (Bruto)</span>
            <div className="stat-icon primary"><TrendingUp size={20} /></div>
          </div>
          <div className="stat-value">{formatCurrency(expectedRevenue)}</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span className="stat-title">Receita Efetivada</span>
            <div className="stat-icon success"><CheckCircle2 size={20} /></div>
          </div>
          <div className="stat-value" style={{color: 'var(--success)'}}>{formatCurrency(actualRevenue)}</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span className="stat-title">Lucro Líquido (Realizado)</span>
            {realizedProfit >= 0 ? 
               <div className="stat-icon" style={{background: 'rgba(52, 211, 153, 0.2)', color: '#34d399'}}><TrendingUp size={20} /></div> : 
               <div className="stat-icon danger"><AlertCircle size={20} /></div>
            }
          </div>
          <div className="stat-value" style={{color: realizedProfit >= 0 ? '#34d399' : 'var(--danger)'}}>{formatCurrency(realizedProfit)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px'}}>Próximos Vencimentos</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingInvoices.map(inv => {
                  const client = clients.find(c => String(c.id) === String(inv.clientId));
                  const isLate = isPast(new Date(inv.dueDate)) && !isToday(new Date(inv.dueDate));
                  return (
                    <tr key={inv.id}>
                      <td>
                        <div className="client-name">
                          <div className="client-avatar" style={{width: '28px', height: '28px', fontSize: '0.7rem'}}>{client?.name?.charAt(0)}</div>
                          {client?.name}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isLate ? 'var(--danger)' : 'inherit' }}>
                          <Clock size={14} />
                          {formatDate(inv.dueDate)}
                          {isLate && <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}> (Atrasado)</span>}
                        </div>
                      </td>
                      <td style={{fontWeight: 600}}>{formatCurrency(inv.value)}</td>
                      <td>
                        <span className={`badge ${isLate ? 'danger' : 'warning'}`}>
                          {isLate ? 'Pendente' : 'Aguardando'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px'}}>Ação Rápida</h3>
          <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px'}}>
            Mantenha suas cobranças em dia. O sistema gerará automaticamente as próximas faturas dos clientes cadastrados.
          </p>
        </div>
      </div>
    </div>
  );
};

const InvoicesTab = ({ clients, invoices }) => {
  return (
    <div className="fade-in">
      <div className="top-header">
        <h1>Visão Geral de <span>Lançamentos</span></h1>
      </div>
      <div className="glass-panel">
         <InvoicesTableComponent invoices={invoices} clients={clients} />
      </div>
    </div>
  );
};


const ProductsTab = ({ products }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [newProduct, setNewProduct] = useState({ name: '', defaultPrice: '', costs: [{ description: '', value: '' }] });

  const handleAddCostLine = (e) => {
    e.preventDefault();
    setNewProduct({ ...newProduct, costs: [...newProduct.costs, { description: '', value: '' }] });
  };

  const handleRemoveCostLine = (e, idx) => {
    e.preventDefault();
    const newCosts = [...newProduct.costs];
    newCosts.splice(idx, 1);
    setNewProduct({ ...newProduct, costs: newCosts });
  };

  const updateCostField = (idx, field, val) => {
    const newCosts = [...newProduct.costs];
    newCosts[idx][field] = val;
    setNewProduct({ ...newProduct, costs: newCosts });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const cleanCosts = newProduct.costs.filter(c => c.description.trim() !== '' && c.value !== '');
    
    if (editingId) {
       await updateDoc(doc(db, 'products', String(editingId)), { ...newProduct, costs: cleanCosts });
    } else {
       if (newProduct.name) {
         await addDoc(collection(db, 'products'), { ...newProduct, costs: cleanCosts });
       }
    }
    setNewProduct({ name: '', defaultPrice: '', costs: [{ description: '', value: '' }] });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (p) => {
    setNewProduct({ name: p.name, defaultPrice: p.defaultPrice, costs: p.costs?.length > 0 ? [...p.costs] : [{ description: '', value: '' }] });
    setEditingId(p.id);
    setShowForm(true);
  }

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'products', String(id)));
  }

  return (
    <div className="fade-in">
      <div className="top-header">
         <h1>Cadastrar <span>Produtos/Serviços</span></h1>
         <button className="btn" onClick={() => {setShowForm(!showForm); setEditingId(null); setNewProduct({name:'', defaultPrice:'', costs: [{ description: '', value: '' }]});}}><Plus size={18} /> Novo Produto & Custos</button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{marginBottom: '16px'}}>{editingId ? "Editar Produto e Custos" : "Adicionar Produto e Mapear Custos"}</h3>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nome do Serviço/Produto</label>
              <input type="text" className="form-input" required
                value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Valor de Venda (R$)</label>
              <input type="number" className="form-input" required
                value={newProduct.defaultPrice} onChange={e => setNewProduct({...newProduct, defaultPrice: e.target.value})} />
            </div>

            <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <label className="form-label" style={{ marginBottom: 0 }}>Custos de Produção / Operacionais</label>
                 <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={handleAddCostLine}>
                    <Plus size={14} /> Adicionar Custo
                 </button>
              </div>

              {newProduct.costs.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  <input type="text" className="form-input" placeholder="Ex: Taxa do Boleto, Funcionário" required={idx === 0 && newProduct.costs.length === 1 ? false : true}
                    value={c.description} onChange={e => updateCostField(idx, 'description', e.target.value)} />
                  <input type="number" className="form-input" placeholder="Val (R$)" style={{ maxWidth: '120px' }} required={c.description ? true : false}
                    value={c.value} onChange={e => updateCostField(idx, 'value', e.target.value)} />
                  <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={(e) => handleRemoveCostLine(e, idx)}>
                    <Minus size={16} />
                  </button>
                </div>
              ))}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                 Total do Custo: <b>{formatCurrency(getTotalCost(newProduct.costs))}</b>
              </div>
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: '12px' }}>
              <button type="submit" className="btn">Salvar Estrutura do Produto</button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome do Serviço</th>
                <th>Valor Venda</th>
                <th>Custos Mapeados</th>
                <th>Custo Total Mensal</th>
                <th>Lucro Estimado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                 const totalC = getTotalCost(p.costs);
                 const profit = Number(p.defaultPrice) - totalC;
                 return (
                  <tr key={p.id}>
                    <td style={{fontWeight: 600}}>{p.name}</td>
                    <td style={{color: 'var(--success)'}}>{formatCurrency(p.defaultPrice)}</td>
                    <td>
                      {p.costs && p.costs.length > 0 ? p.costs.map((c, i) => (
                        <div key={i} style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{c.description}: R$ {c.value}</div>
                      )) : <span style={{fontSize: '0.8rem', color: '#666'}}>Sem custos listados</span>}
                    </td>
                    <td style={{color: 'var(--danger)'}}>{formatCurrency(totalC)}</td>
                    <td style={{fontWeight: 600}}>{formatCurrency(profit)}</td>
                    <td style={{display: 'flex', gap: '8px'}}>
                       <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.75rem' }} onClick={() => startEdit(p)}>
                         <Edit2 size={14} />
                       </button>
                       <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--danger)' }} onClick={() => handleDelete(p.id)}>
                         <Trash2 size={14} />
                       </button>
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


// --- Aba Clientes Principal e View de Perfil ---

const ClientDetailView = ({ client, setViewingClient, invoices, products }) => {
  const openWhatsapp = (phone) => {
    if (!phone) return;
    const cleanPhone = String(phone).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const clientInvoices = invoices.filter(inv => String(inv.clientId) === String(client.id));
  const expectedTotal = clientInvoices.reduce((acc, curr) => acc + curr.value, 0);
  const paidTotal = clientInvoices.filter(i => i.status === 'Pago').reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="fade-in">
      <div className="top-header" style={{ marginBottom: '16px' }}>
         <button className="btn btn-secondary" onClick={() => setViewingClient(null)} style={{ border: 'none', padding: '0 12px 0 0' }}>
            <ChevronLeft size={20} /> Voltar para lista
         </button>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
             <div className="client-avatar" style={{width: '60px', height: '60px', fontSize: '1.5rem'}}>{client.name.charAt(0)}</div>
             <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{client.name}</h2>
                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                   <span>Frequência: <b>{client.frequency}</b></span>
                   <span>Início: <b>{formatDate(client.startDate)}</b></span>
                   <span>Contrato Base: <b>{products.find(p=>String(p.id)===String(client.productId))?.name || 'Sem produto'}</b></span>
                </div>
             </div>
         </div>
         <div>
            <button className="btn" style={{ backgroundColor: '#25D366', color: 'white', fontWeight: 600, padding: '12px 20px' }} onClick={() => openWhatsapp(client.phone)}>
                <MessageCircle size={18} /> Falar no WhatsApp
            </button>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div className="glass-panel stat-card" style={{ padding: '16px 24px' }}>
              <span className="stat-title">Total Emitido ao Cliente</span>
              <div className="stat-value" style={{fontSize: '1.5rem'}}>{formatCurrency(expectedTotal)}</div>
          </div>
          <div className="glass-panel stat-card" style={{ padding: '16px 24px' }}>
              <span className="stat-title">Total Pago (Já Efetivado)</span>
              <div className="stat-value" style={{fontSize: '1.5rem', color: 'var(--success)'}}>{formatCurrency(paidTotal)}</div>
          </div>
      </div>

      <h3 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px'}}>Mensalidades e Lançamentos Gerados deste Cliente</h3>
      <div className="glass-panel">
         <InvoicesTableComponent invoices={clientInvoices} clients={[client]} />
      </div>

    </div>
  );
}

const ClientsTab = ({ clients, products, invoices }) => {
  const [showForm, setShowForm] = useState(false);
  const [viewingClient, setViewingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', frequency: 'Semanal', value: '', productId: '', startDate: '', endDate: ''
  });

  const handleAddClient = async (e) => {
    e.preventDefault();
    const selectedProd = products.find(p => String(p.id) === String(formData.productId));
    const prodCost = selectedProd ? getTotalCost(selectedProd.costs) : 0;

    const newClientData = {
      ...formData,
      productId: String(formData.productId),
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString()
    };
    
    // Save to Firebase first to get real ID
    const docRef = await addDoc(collection(db, 'clients'), newClientData);
    
    // Attach Real Doc ID for invoice association
    const newClient = { ...newClientData, id: docRef.id };
    
    const newInvoices = generateInvoicesForClient(newClient, prodCost);
    
    // Save invoices to Firebase
    for(let inv of newInvoices) {
       await addDoc(collection(db, 'invoices'), inv);
    }

    setFormData({ name: '', phone: '', frequency: 'Semanal', value: '', productId: '', startDate: '', endDate: '' });
    setShowForm(false);
    alert('Cliente cadastrado e cobranças geradas com sucesso!');
  };

  const handleDeleteClient = async (id) => {
    await deleteDoc(doc(db, 'clients', String(id)));
  };

  if (viewingClient) {
    return <ClientDetailView client={viewingClient} setViewingClient={setViewingClient} invoices={invoices} products={products} />
  }

  return (
    <div className="fade-in">
      <div className="top-header">
         <h1>Gerenciar <span>Clientes</span></h1>
         <button className="btn" onClick={() => setShowForm(!showForm)}><Plus size={18} /> Novo Contrato</button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{marginBottom: '16px'}}>Cadastrar Cliente</h3>
          <form onSubmit={handleAddClient} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Nome da Empresa / Cliente</label>
              <input type="text" className="form-input" required
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">WhatsApp (com DDD)</label>
              <input type="text" className="form-input" placeholder="Ex: 85999999999" required
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Produto / Serviço Contratado</label>
              <select className="form-select" required
                value={formData.productId} onChange={e => {
                  const p = products.find(prod => String(prod.id) === String(e.target.value));
                  setFormData({...formData, productId: e.target.value, value: p ? p.defaultPrice : formData.value})
                }}>
                <option value="" disabled>Selecione um Produto Mapeado</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Pagamento</label>
              <select className="form-select" required
                value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})}>
                <option value="Semanal">Semanal</option>
                <option value="Quinzenal">Quinzenal</option>
                <option value="Mensal">Mensal</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Valor Combinado do Contrato (R$)</label>
              <input type="number" className="form-input" required
                value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
            </div>

            <div></div>

            <div className="form-group">
              <label className="form-label">Início do Contrato</label>
              <input type="date" className="form-input" required
                value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Fim do Contrato (Previsão)</label>
              <input type="date" className="form-input" required
                value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <button type="submit" className="btn">Salvar e Gerar Carnê</button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Serviço / Frequência</th>
                <th>Valor Base</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="client-name">
                      <div className="client-avatar">{c.name?.charAt(0)}</div>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                        <span>{c.name}</span>
                        <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{c.phone}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{display:'flex', flexDirection: 'column', gap: '2px'}}>
                      <span style={{fontWeight: 500}}>{products.find(p=>String(p.id)===String(c.productId))?.name || '-'}</span>
                      <span className={`badge`} style={{display: 'inline-block', width: 'fit-content'}}>{c.frequency}</span>
                    </div>
                  </td>
                  <td style={{fontWeight: 600}}>{formatCurrency(c.value)}</td>
                  <td style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                     <button className="btn" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => setViewingClient(c)}>
                        <Eye size={14} /> Ver Perfil
                     </button>
                     <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--danger)' }} onClick={() => handleDeleteClient(c.id)}>
                        <Trash2 size={14} />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      (email === 'comercial1.emphasis@gmail.com' && password === '12Rod34#') ||
      (email === 'mesocialmedia16@gmail.com' && password === 'Casa920125#')
    ) {
      onLogin(true);
    } else {
      setError('Email ou Senha incorretos. Acesso negado.');
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-black)' }}>
      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '24px', marginBottom: '16px'}}>E</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Emphasis ERP</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', textAlign: 'center' }}>Insira suas credenciais para gerenciar a agência.</p>
        
        {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', width: '100%', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div className="form-group" style={{marginBottom: '20px'}}>
            <label className="form-label">Email de Acesso</label>
            <input type="email" required className="form-input" placeholder="agencia@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: '32px' }}>
            <label className="form-label">Senha</label>
            <input type="password" required className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn" style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '1rem' }}>Entrar no Sistema</button>
        </form>
      </div>
    </div>
  );
};

// --- App Root ---

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('emphasis_auth') === 'true';
  });

  const handleLogin = (status) => {
    setIsAuthenticated(status);
    if (status) {
      localStorage.setItem('emphasis_auth', 'true');
    } else {
      localStorage.removeItem('emphasis_auth');
    }
  };

  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Real-time Cloud States
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Auto-migration local to Firebase
  useEffect(() => {
    if (!isAuthenticated) return;

    const performMigration = async () => {
      const isMigrated = localStorage.getItem('firebase_migrated') === 'true';
      if (isMigrated) return;

      const lsProducts = JSON.parse(localStorage.getItem('emphasis_products') || '[]');
      const lsClients = JSON.parse(localStorage.getItem('emphasis_clients') || '[]');
      const lsInvoices = JSON.parse(localStorage.getItem('emphasis_invoices') || '[]');

      if (lsProducts.length === 0 && lsClients.length === 0) return;

      console.log('Migrating LocalStorage to Firebase...');
      
      for (let p of lsProducts) await setDoc(doc(db, 'products', String(p.id)), p);
      for (let c of lsClients) await setDoc(doc(db, 'clients', String(c.id)), c);
      for (let inv of lsInvoices) await setDoc(doc(db, 'invoices', String(inv.id)), inv);

      localStorage.setItem('firebase_migrated', 'true');
      console.log('Migration Complete');
    };

    performMigration();
  }, [isAuthenticated]);

  // Real-time Listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubProducts = onSnapshot(collection(db, 'products'), snapshot => {
      setProducts(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    
    const unsubClients = onSnapshot(collection(db, 'clients'), snapshot => {
      setClients(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), snapshot => {
      setInvoices(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => {
      unsubProducts();
      unsubClients();
      unsubInvoices();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => handleLogin(false)} />
      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard clients={clients} invoices={invoices} />}
        {activeTab === 'invoices' && <InvoicesTab clients={clients} invoices={invoices} />}
        {activeTab === 'clients' && <ClientsTab clients={clients} products={products} invoices={invoices} />}
        {activeTab === 'products' && <ProductsTab products={products} />}
      </main>
    </div>
  );
}

export default App;
