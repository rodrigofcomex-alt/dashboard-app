import React, { useState, useEffect } from 'react';
import { initialClients, initialInvoices, initialProducts } from './data';
import { format, isPast, isToday, addDays, addMonths, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LayoutDashboard, Users, Receipt, TrendingUp, AlertCircle, 
  CheckCircle2, Clock, Plus, Package, MessageCircle, 
  Trash2, Edit2, Minus, ChevronLeft, Eye, LogOut, RotateCcw
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

  const handleRevert = async (id) => {
    await updateDoc(doc(db, 'invoices', String(id)), { 
      status: 'Aguardando', 
      paidDate: null 
    });
  };

  const startEditing = (inv) => {
    setEditingId(inv.id);
    setEditData({ value: inv.value, cost: inv.cost, dueDate: format(new Date(inv.dueDate), 'yyyy-MM-dd') });
  };

  const saveEdit = async (id) => {
    // Fix: appending T12:00:00 prevents timezone shift (UTC-3 would roll back 1 day at midnight)
    const safeDate = new Date(editData.dueDate + 'T12:00:00').toISOString();
    await updateDoc(doc(db, 'invoices', String(id)), {
      value: Number(editData.value), 
      cost: Number(editData.cost), 
      dueDate: safeDate
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
            <th>Referente a</th>
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
                <td style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>{inv.description || '—'}</td>
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
                  {inv.status === 'Pago' && (
                    <button 
                      className="btn btn-secondary" 
                      title="Estornar pagamento"
                      style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#f59e0b', gap: '4px' }}
                      onClick={() => handleRevert(inv.id)}
                    >
                      <RotateCcw size={13} /> Estornar
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
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px' }}>E</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Emphasis</h2>
        </div>
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
                <span className="nav-label">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-logout">
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', color: 'var(--danger)', border: 'none', background: 'transparent' }} onClick={onLogout}>
          <LogOut size={18} /> Sair do Sistema
        </button>
      </div>
    </aside>
  );
};

const Dashboard = ({ clients, invoices, contracts, products }) => {
  // Receitas
  const totalEmitido = invoices.filter(i => i.status !== 'Cancelado').reduce((acc, i) => acc + (Number(i.value) || 0), 0);
  const totalRecebido = invoices.filter(i => i.status === 'Pago').reduce((acc, i) => acc + (Number(i.value) || 0), 0);
  const totalPendente = invoices.filter(i => i.status === 'Aguardando').reduce((acc, i) => acc + (Number(i.value) || 0), 0);

  // Custo real por fatura: usa o cost salvo na fatura (gerado automaticamente)
  // Para faturas sem cost (avulsas, contrato manual), tenta buscar custo via contrato -> produto
  const getCostForInvoice = (inv) => {
    if (inv.cost && Number(inv.cost) > 0) return Number(inv.cost);
    // Tenta via contractId
    if (inv.contractId) {
      const contract = contracts.find(c => String(c.id) === String(inv.contractId));
      if (contract && contract.productId) {
        const product = products.find(p => String(p.id) === String(contract.productId));
        if (product) {
          let baseCost = getTotalCost(product.costs);
          if (contract.frequency === 'Semanal') baseCost = baseCost / 4;
          else if (contract.frequency === 'Quinzenal') baseCost = baseCost / 2;
          return baseCost;
        }
      }
    }
    return 0;
  };

  const totalCustoRealizado = invoices.filter(i => i.status === 'Pago').reduce((acc, i) => acc + getCostForInvoice(i), 0);
  const lucroLiquido = totalRecebido - totalCustoRealizado;
  const margemPercent = totalRecebido > 0 ? ((lucroLiquido / totalRecebido) * 100).toFixed(1) : 0;

  const upcomingInvoices = invoices
    .filter(i => i.status !== 'Pago')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <div className="fade-in">
      <div className="top-header">
        <h1>Visão Geral do <span>Caixa</span></h1>
      </div>

      {/* Cards principais */}
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span className="stat-title">Faturamento Emitido (Bruto)</span>
            <div className="stat-icon primary"><TrendingUp size={20} /></div>
          </div>
          <div className="stat-value">{formatCurrency(totalEmitido)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Total de cobranças geradas</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span className="stat-title">Receita Efetivada</span>
            <div className="stat-icon success"><CheckCircle2 size={20} /></div>
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(totalRecebido)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Pagamentos confirmados</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span className="stat-title">A Receber (Pendente)</span>
            <div className="stat-icon" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}><Clock size={20} /></div>
          </div>
          <div className="stat-value" style={{ color: '#fbbf24' }}>{formatCurrency(totalPendente)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Aguardando pagamento</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span className="stat-title">Lucro Líquido (Realizado)</span>
            {lucroLiquido >= 0
              ? <div className="stat-icon" style={{ background: 'rgba(52,211,153,0.2)', color: '#34d399' }}><TrendingUp size={20} /></div>
              : <div className="stat-icon danger"><AlertCircle size={20} /></div>
            }
          </div>
          <div className="stat-value" style={{ color: lucroLiquido >= 0 ? '#34d399' : 'var(--danger)' }}>{formatCurrency(lucroLiquido)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Margem: <b style={{ color: lucroLiquido >= 0 ? '#34d399' : 'var(--danger)' }}>{margemPercent}%</b>
            {totalCustoRealizado > 0 && <span> • Custos: {formatCurrency(totalCustoRealizado)}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Próximos Vencimentos</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Referente a</th>
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
                          <div className="client-avatar" style={{ width: '28px', height: '28px', fontSize: '0.7rem' }}>{client?.name?.charAt(0)}</div>
                          {client?.name}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.description || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isLate ? 'var(--danger)' : 'inherit' }}>
                          <Clock size={14} />
                          {formatDate(inv.dueDate)}
                          {isLate && <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}> (Atrasado)</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(inv.value)}</td>
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
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Resumo Financeiro</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Clientes ativos', value: clients.length, unit: 'clientes', color: 'var(--primary)' },
              { label: 'Contratos ativos', value: contracts.length, unit: 'contratos', color: '#818cf8' },
              { label: 'Faturas em aberto', value: invoices.filter(i => i.status === 'Aguardando').length, unit: 'faturas', color: '#fbbf24' },
              { label: 'Faturas pagas', value: invoices.filter(i => i.status === 'Pago').length, unit: 'faturas', color: 'var(--success)' },
              { label: 'Taxa de recebimento', value: invoices.length > 0 ? ((invoices.filter(i => i.status === 'Pago').length / invoices.filter(i=>i.status!=='Cancelado').length) * 100).toFixed(0) : 0, unit: '%', color: 'var(--success)' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.label}</span>
                <span style={{ fontWeight: 700, color: item.color }}>{item.value} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>{item.unit}</span></span>
              </div>
            ))}
          </div>
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
              <label className="form-label">Valor Mínimo (R$)</label>
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
                <th>Valor Mínimo</th>
                <th>Custos Mapeados</th>
                <th>Custo Total</th>
                <th>Lucro Mín. Estimado</th>
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

// --- Tela interna do Contrato ---
const ContractDetailView = ({ contract, client, invoices, products, onBack }) => {
  const [mode, setMode] = useState(null); // null | 'unico' | 'lote' | 'edit'
  const [dueDates, setDueDates] = useState(['']);
  const [editData, setEditData] = useState({
    services: contract.services?.length > 0 ? [...contract.services] : [{ name: '', value: '' }],
    frequency: contract.frequency || 'Mensal',
    startDate: contract.startDate ? contract.startDate.substring(0, 10) : '',
    endDate: contract.endDate ? contract.endDate.substring(0, 10) : '',
  });

  const totalEdit = editData.services.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  const addEditService = (e) => { e.preventDefault(); setEditData(p => ({ ...p, services: [...p.services, { name: '', value: '' }] })); };
  const removeEditService = (e, idx) => { e.preventDefault(); setEditData(p => ({ ...p, services: p.services.filter((_, i) => i !== idx) })); };
  const updateEditService = (idx, field, val) => setEditData(p => { const s = [...p.services]; s[idx][field] = val; return { ...p, services: s }; });

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const cleanServices = editData.services.filter(s => s.name.trim() !== '' && s.value !== '');
    const totalValue = cleanServices.reduce((acc, s) => acc + Number(s.value), 0);
    await updateDoc(doc(db, 'contracts', String(contract.id)), {
      services: cleanServices,
      value: totalValue,
      frequency: editData.frequency,
      startDate: new Date(editData.startDate + 'T12:00:00').toISOString(),
      endDate: new Date(editData.endDate + 'T12:00:00').toISOString(),
    });
    setMode(null);
  };

  const contractLabel = contract.services && contract.services.length > 0
    ? contract.services.map(s => s.name).join(' + ')
    : (products.find(p => String(p.id) === String(contract.productId))?.name || 'Contrato');

  const contractInvoices = invoices.filter(inv => String(inv.contractId) === String(contract.id));
  const totalEmitido = contractInvoices.reduce((acc, i) => acc + i.value, 0);
  const totalPago = contractInvoices.filter(i => i.status === 'Pago').reduce((acc, i) => acc + i.value, 0);
  const totalPendente = totalEmitido - totalPago;

  const addDate = (e) => { e.preventDefault(); setDueDates(p => [...p, '']); };
  const removeDate = (e, idx) => { e.preventDefault(); setDueDates(p => p.filter((_, i) => i !== idx)); };
  const updateDate = (idx, val) => setDueDates(p => { const d = [...p]; d[idx] = val; return d; });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validDates = dueDates.filter(d => d.trim() !== '');
    for (let dateStr of validDates) {
      await addDoc(collection(db, 'invoices'), {
        clientId: String(client.id),
        contractId: String(contract.id),
        dueDate: new Date(dateStr + 'T12:00:00').toISOString(),
        value: Number(contract.value),
        cost: 0,
        description: contractLabel,
        status: 'Aguardando',
        paidDate: null,
        type: 'contrato'
      });
    }
    setDueDates(['']);
    setMode(null);
  };

  return (
    <div className="fade-in">
      {/* Breadcrumb navegation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ border: 'none', padding: '0 10px 0 0', background: 'none' }}>
          <ChevronLeft size={18} /> {client.name}
        </button>
        <span>/</span>
        <span style={{ color: 'white', fontWeight: 600 }}>{contractLabel}</span>
      </div>

      {/* Header: visualizacao ou edicao */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        {mode === 'edit' ? (
          <form onSubmit={handleSaveEdit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Editando Contrato</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn" style={{ padding: '7px 16px', fontSize: '0.85rem' }}>Salvar</button>
                <button type="button" className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.85rem' }} onClick={() => setMode(null)}>Cancelar</button>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Serviços e Valores</label>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={addEditService}><Plus size={12} /> Serviço</button>
              </div>
              {editData.services.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input type="text" required className="form-input" placeholder="Nome do serviço" value={s.name} onChange={e => updateEditService(idx, 'name', e.target.value)} style={{ flex: 2 }} />
                  <input type="number" required className="form-input" placeholder="R$" value={s.value} onChange={e => updateEditService(idx, 'value', e.target.value)} style={{ flex: 1, maxWidth: '130px' }} />
                  {editData.services.length > 1 && (
                    <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} onClick={e => removeEditService(e, idx)}><Minus size={13} /></button>
                  )}
                </div>
              ))}
              <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '0.85rem' }}>
                Total: <b style={{ color: 'var(--success)' }}>{formatCurrency(totalEdit)}</b>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Frequência</label>
                <select className="form-select" value={editData.frequency} onChange={e => setEditData(p => ({ ...p, frequency: e.target.value }))}>
                  <option value="Semanal">Semanal</option>
                  <option value="Quinzenal">Quinzenal</option>
                  <option value="Mensal">Mensal</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Início</label>
                <input type="date" required className="form-input" value={editData.startDate} onChange={e => setEditData(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Término</label>
                <input type="date" required className="form-input" value={editData.endDate} onChange={e => setEditData(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '10px' }}>{contractLabel}</h2>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {contract.services && contract.services.map((s, i) => (
                  <span key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {s.name}: <b style={{ color: 'var(--success)' }}>{formatCurrency(s.value)}</b>
                  </span>
                ))}
              </div>
              <div style={{ marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Frequência: <b style={{ color: 'white' }}>{contract.frequency}</b></span>
                {contract.startDate && <span>Início: <b style={{ color: 'white' }}>{formatDate(contract.startDate)}</b></span>}
                {contract.endDate && <span>Término: <b style={{ color: 'white' }}>{formatDate(contract.endDate)}</b></span>}
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>Total: {formatCurrency(contract.value)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" style={{ padding: '8px 14px' }} onClick={() => { setEditData({ services: contract.services?.length > 0 ? [...contract.services] : [{ name: '', value: '' }], frequency: contract.frequency || 'Mensal', startDate: contract.startDate?.substring(0, 10) || '', endDate: contract.endDate?.substring(0, 10) || '' }); setMode('edit'); }}>
                <Edit2 size={15} /> Editar
              </button>
              <button className="btn" style={{ padding: '8px 16px' }} onClick={() => setMode(mode === 'unico' ? null : 'unico')}>
                <Plus size={15} /> Pagamento
              </button>
              <button className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setMode(mode === 'lote' ? null : 'lote')}>
                <Plus size={15} /> Em Lote
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form de adicionar débito */}
      {(mode === 'unico' || mode === 'lote') && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', border: '1px solid rgba(99,102,241,0.3)' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>
            {mode === 'unico' ? 'Adicionar Pagamento' : 'Adicionar em Lote'} — <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Valor: <b style={{ color: 'var(--success)' }}>{formatCurrency(contract.value)}</b> por cobrança</span>
          </h4>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {dueDates.map((d, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{idx+1}</span>
                  <input type="date" required className="form-input" style={{ padding: '9px', width: 'auto' }} value={d} onChange={e => updateDate(idx, e.target.value)} />
                  {dueDates.length > 1 && (
                    <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} onClick={e => removeDate(e, idx)}><Minus size={13} /></button>
                  )}
                </div>
              ))}
              {mode === 'lote' && (
                <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem' }} onClick={addDate}>
                  <Plus size={13} /> Data
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn">
                Lançar {dueDates.filter(d=>d).length} Cobrança{dueDates.filter(d=>d).length !== 1 ? 's' : ''}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setMode(null); setDueDates(['']); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Cards de totais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ padding: '16px 20px' }}>
          <span className="stat-title">Total Emitido</span>
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCurrency(totalEmitido)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '16px 20px' }}>
          <span className="stat-title">Total Pago</span>
          <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--success)' }}>{formatCurrency(totalPago)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '16px 20px' }}>
          <span className="stat-title">Pendente / Em Aberto</span>
          <div className="stat-value" style={{ fontSize: '1.4rem', color: totalPendente > 0 ? 'var(--warning)' : 'var(--success)' }}>{formatCurrency(totalPendente)}</div>
        </div>
      </div>

      {/* Tabela de cobranças do contrato */}
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Débitos deste Contrato ({contractInvoices.length})</h3>
      <div className="glass-panel">
        <InvoicesTableComponent invoices={contractInvoices} clients={[client]} />
      </div>
    </div>
  );
};

// --- Card de contrato na lista ---
const ContractCard = ({ contract, client, products, onOpen }) => {
  const contractLabel = contract.services && contract.services.length > 0
    ? contract.services.map(s => s.name).join(' + ')
    : (products.find(p => String(p.id) === String(contract.productId))?.name || 'Contrato');

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onOpen}>
          <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {contractLabel}
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: '4px' }}>Ver detalhes →</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {contract.services && contract.services.map((s, i) => (
              <span key={i} style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {s.name}: <b style={{ color: 'var(--success)' }}>{formatCurrency(s.value)}</b>
              </span>
            ))}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <span>Frequência: <b>{contract.frequency}</b></span>
            {contract.startDate && <span>Início: <b>{formatDate(contract.startDate)}</b></span>}
            {contract.endDate && <span>Término: <b>{formatDate(contract.endDate)}</b></span>}
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>Total: {formatCurrency(contract.value)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button className="btn" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={onOpen}>
            <Eye size={13} /> Abrir
          </button>
          <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={() => deleteDoc(doc(db, 'contracts', String(contract.id)))}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ClientDetailView = ({ client, setViewingClient, invoices, contracts, products }) => {
  const [showAvulsaForm, setShowAvulsaForm] = useState(false);
  const [showLoteForm, setShowLoteForm] = useState(false);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [avulsaData, setAvulsaData] = useState({ dueDate: '', value: '', description: '' });
  const [loteData, setLoteData] = useState({ value: '', description: '', dates: [''] });
  const [novoContrato, setNovoContrato] = useState({ frequency: 'Mensal', productId: '', startDate: '', endDate: '', services: [{ name: '', value: '' }], autoGerar: true });

  const totalNC = novoContrato.services.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  const addNCService = (e) => { e.preventDefault(); setNovoContrato(p => ({ ...p, services: [...p.services, { name: '', value: '' }] })); };
  const removeNCService = (e, idx) => { e.preventDefault(); setNovoContrato(p => ({ ...p, services: p.services.filter((_, i) => i !== idx) })); };
  const updateNCService = (idx, field, val) => setNovoContrato(p => { const s = [...p.services]; s[idx][field] = val; return { ...p, services: s }; });

  const handleSalvarNovoContrato = async (e) => {
    e.preventDefault();
    const cleanServices = novoContrato.services.filter(s => s.name.trim() !== '' && s.value !== '');
    const totalValue = cleanServices.reduce((acc, s) => acc + Number(s.value), 0);
    const startISO = new Date(novoContrato.startDate + 'T12:00:00').toISOString();
    const endISO = new Date(novoContrato.endDate + 'T12:00:00').toISOString();

    await addDoc(collection(db, 'contracts'), {
      clientId: String(client.id),
      services: cleanServices,
      value: totalValue,
      frequency: novoContrato.frequency,
      productId: String(novoContrato.productId),
      startDate: startISO,
      endDate: endISO,
      createdAt: new Date().toISOString()
    });

    if (novoContrato.autoGerar) {
      const fakeClient = { id: client.id, value: totalValue, frequency: novoContrato.frequency, startDate: startISO, endDate: endISO };
      const selectedProd = products.find(p => String(p.id) === String(novoContrato.productId));
      const prodCost = selectedProd ? getTotalCost(selectedProd.costs) : 0;
      const newInvoices = generateInvoicesForClient(fakeClient, prodCost);
      const label = cleanServices.map(s => s.name).join(' + ');
      for (let inv of newInvoices) {
        await addDoc(collection(db, 'invoices'), { ...inv, description: label, type: 'contrato' });
      }
    }
    setNovoContrato({ frequency: 'Mensal', productId: '', startDate: '', endDate: '', services: [{ name: '', value: '' }], autoGerar: true });
    setShowNovoContrato(false);
  };

  const openWhatsapp = (phone) => {
    if (!phone) return;
    const cleanPhone = String(phone).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleAddAvulsa = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'invoices'), {
      clientId: String(client.id),
      dueDate: new Date(avulsaData.dueDate + 'T12:00:00').toISOString(),
      value: Number(avulsaData.value),
      cost: 0,
      description: avulsaData.description,
      status: 'Aguardando',
      paidDate: null,
      type: 'avulsa'
    });
    setAvulsaData({ dueDate: '', value: '', description: '' });
    setShowAvulsaForm(false);
  };

  const handleAddLote = async (e) => {
    e.preventDefault();
    const validDates = loteData.dates.filter(d => d.trim() !== '');
    if (validDates.length === 0) return;
    for (let dateStr of validDates) {
      await addDoc(collection(db, 'invoices'), {
        clientId: String(client.id),
        dueDate: new Date(dateStr + 'T12:00:00').toISOString(),
        value: Number(loteData.value),
        cost: 0,
        description: loteData.description,
        status: 'Aguardando',
        paidDate: null,
        type: 'avulsa'
      });
    }
    setLoteData({ value: '', description: '', dates: [''] });
    setShowLoteForm(false);
  };

  const addLoteDate = (e) => { e.preventDefault(); setLoteData(prev => ({ ...prev, dates: [...prev.dates, ''] })); };
  const removeLoteDate = (e, idx) => { e.preventDefault(); setLoteData(prev => ({ ...prev, dates: prev.dates.filter((_, i) => i !== idx) })); };
  const updateLoteDate = (idx, val) => setLoteData(prev => { const d = [...prev.dates]; d[idx] = val; return { ...prev, dates: d }; });

  const clientInvoices = invoices.filter(inv => String(inv.clientId) === String(client.id));
  const clientContracts = contracts.filter(c => String(c.clientId) === String(client.id));
  const expectedTotal = clientInvoices.reduce((acc, curr) => acc + curr.value, 0);
  const paidTotal = clientInvoices.filter(i => i.status === 'Pago').reduce((acc, curr) => acc + curr.value, 0);

  const [viewingContract, setViewingContract] = useState(null);

  if (viewingContract) {
    return <ContractDetailView contract={viewingContract} client={client} invoices={invoices} products={products} onBack={() => setViewingContract(null)} />;
  }

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
                   <span>Frequência: <b>{client.frequency || 'Manual'}</b></span>
                   {client.startDate && <span>Início: <b>{formatDate(client.startDate)}</b></span>}
                   {client.productId && <span>Contrato Base: <b>{products.find(p=>String(p.id)===String(client.productId))?.name || 'Sem produto'}</b></span>}
                </div>
             </div>
         </div>
         <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" style={{ padding: '10px 16px' }} onClick={() => { setShowLoteForm(!showLoteForm); setShowAvulsaForm(false); }}>
                <Plus size={18} /> Cobranças em Lote
            </button>
            <button className="btn" style={{ padding: '10px 16px' }} onClick={() => { setShowAvulsaForm(!showAvulsaForm); setShowLoteForm(false); }}>
                <Plus size={18} /> Cobrança Avulsa
            </button>
            <button className="btn" style={{ backgroundColor: '#25D366', color: 'white', fontWeight: 600, padding: '10px 16px' }} onClick={() => openWhatsapp(client.phone)}>
                <MessageCircle size={18} /> WhatsApp
            </button>
         </div>
      </div>

      {showAvulsaForm && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(99,102,241,0.3)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Nova Cobrança Avulsa — <span style={{ color: 'var(--primary)' }}>{client.name}</span></h3>
          <form onSubmit={handleAddAvulsa} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '16px', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Vencimento</label>
              <input type="date" required className="form-input" value={avulsaData.dueDate} onChange={e => setAvulsaData({...avulsaData, dueDate: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Valor (R$)</label>
              <input type="number" required className="form-input" placeholder="0,00" value={avulsaData.value} onChange={e => setAvulsaData({...avulsaData, value: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Referente a (trabalho/serviço)</label>
              <input type="text" required className="form-input" placeholder="Ex: Arte para campanha de Páscoa" value={avulsaData.description} onChange={e => setAvulsaData({...avulsaData, description: e.target.value})} />
            </div>
            <button type="submit" className="btn" style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>Lançar</button>
          </form>
        </div>
      )}

      {showLoteForm && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(99,102,241,0.3)' }}>
          <h3 style={{ marginBottom: '4px', fontSize: '1rem' }}>Gerar Cobranças em Lote — <span style={{ color: 'var(--primary)' }}>{client.name}</span></h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Defina o valor e a descrição uma vez e adicione todos os vencimentos que precisar.</p>
          <form onSubmit={handleAddLote}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Valor por Cobrança (R$)</label>
                <input type="number" required className="form-input" placeholder="0,00" value={loteData.value} onChange={e => setLoteData({...loteData, value: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Referente a (trabalho/serviço)</label>
                <input type="text" required className="form-input" placeholder="Ex: Gestão de Redes - Abril, Maio, Junho" value={loteData.description} onChange={e => setLoteData({...loteData, description: e.target.value})} />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Datas de Vencimento ({loteData.dates.length} cobrança{loteData.dates.length > 1 ? 's' : ''})</label>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={addLoteDate}>
                  <Plus size={13} /> Adicionar Data
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {loteData.dates.map((d, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '20px' }}>#{idx+1}</span>
                    <input type="date" required className="form-input" style={{ padding: '8px', width: 'auto' }} value={d} onChange={e => updateLoteDate(idx, e.target.value)} />
                    {loteData.dates.length > 1 && (
                      <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} onClick={e => removeLoteDate(e, idx)}>
                        <Minus size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn">Lançar {loteData.dates.filter(d=>d).length} Cobrança{loteData.dates.filter(d=>d).length > 1 ? 's' : ''}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowLoteForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

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

      {/* Seção de Contratos Ativos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{fontSize: '1.1rem', fontWeight: 600}}>Contratos Ativos</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{clientContracts.length} contrato{clientContracts.length !== 1 ? 's' : ''}</span>
          <button className="btn" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => setShowNovoContrato(p => !p)}>
            <Plus size={14} /> Novo Contrato
          </button>
        </div>
      </div>

      {showNovoContrato && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px', border: '1px solid rgba(99,102,241,0.3)' }}>
          <h4 style={{ marginBottom: '16px', fontSize: '0.95rem' }}>Novo Contrato — <span style={{ color: 'var(--primary)' }}>{client.name}</span></h4>
          <form onSubmit={handleSalvarNovoContrato}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Frequência</label>
                <select className="form-select" value={novoContrato.frequency} onChange={e => setNovoContrato(p => ({...p, frequency: e.target.value}))}>
                  <option value="Semanal">Semanal</option>
                  <option value="Quinzenal">Quinzenal</option>
                  <option value="Mensal">Mensal</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Pacote Base (opcional)</label>
                <select className="form-select" value={novoContrato.productId} onChange={e => setNovoContrato(p => ({...p, productId: e.target.value}))}>
                  <option value="">Nenhum / Manual</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Início</label>
                <input type="date" required className="form-input" value={novoContrato.startDate} onChange={e => setNovoContrato(p => ({...p, startDate: e.target.value}))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Término</label>
                <input type="date" required className="form-input" value={novoContrato.endDate} onChange={e => setNovoContrato(p => ({...p, endDate: e.target.value}))} />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Serviços e Valores</label>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={addNCService}>
                  <Plus size={12} /> Serviço
                </button>
              </div>
              {novoContrato.services.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input type="text" required className="form-input" placeholder="Ex: Social Media" value={s.name} onChange={e => updateNCService(idx, 'name', e.target.value)} style={{ flex: 2 }} />
                  <input type="number" required className="form-input" placeholder="R$" value={s.value} onChange={e => updateNCService(idx, 'value', e.target.value)} style={{ flex: 1, maxWidth: '120px' }} />
                  {novoContrato.services.length > 1 && (
                    <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} onClick={e => removeNCService(e, idx)}><Minus size={12} /></button>
                  )}
                </div>
              ))}
              <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Total: <b style={{ color: 'var(--success)' }}>{formatCurrency(totalNC)}</b>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.85rem' }}>Gerar cobranças automaticamente?</span>
              <button type="button" onClick={() => setNovoContrato(p => ({...p, autoGerar: !p.autoGerar}))}
                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                  background: novoContrato.autoGerar ? 'var(--success)' : 'rgba(255,255,255,0.08)',
                  color: novoContrato.autoGerar ? '#064e3b' : 'var(--text-muted)' }}>
                {novoContrato.autoGerar ? '✓ Sim' : '✗ Não'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn" style={{ padding: '8px 20px' }}>Salvar Contrato</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px' }} onClick={() => setShowNovoContrato(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px' }}>
        {clientContracts.length === 0 && !showNovoContrato
          ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '16px' }}>Nenhum contrato vinculado. Clique em "+ Novo Contrato" para adicionar.</p>
          : clientContracts.map(c => <ContractCard key={c.id} contract={c} client={client} products={products} onOpen={() => setViewingContract(c)} />)
        }
      </div>

      <h3 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px'}}>Todos os Lançamentos deste Cliente</h3>
      <div className="glass-panel">
         <InvoicesTableComponent invoices={clientInvoices} clients={[client]} />
      </div>

    </div>
  );
}

const ClientsTab = ({ clients, products, invoices, contracts }) => {
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('simples');
  const [autoGerar, setAutoGerar] = useState(true);
  const [viewingClient, setViewingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', frequency: 'Semanal', productId: '', startDate: '', endDate: '',
    services: [{ name: '', value: '' }]
  });

  const totalServicos = formData.services.reduce((acc, s) => acc + (Number(s.value) || 0), 0);

  const addServiceLine = (e) => { e.preventDefault(); setFormData(prev => ({ ...prev, services: [...prev.services, { name: '', value: '' }] })); };
  const removeServiceLine = (e, idx) => { e.preventDefault(); setFormData(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== idx) })); };
  const updateService = (idx, field, val) => setFormData(prev => { const s = [...prev.services]; s[idx][field] = val; return { ...prev, services: s }; });

  const resetForm = () => {
    setFormData({ name: '', phone: '', frequency: 'Semanal', productId: '', startDate: '', endDate: '', services: [{ name: '', value: '' }] });
    setShowForm(false);
    setFormMode('simples');
    setAutoGerar(true);
  };

  const handleAddClient = async (e) => {
    e.preventDefault();

    if (formMode === 'simples') {
      await addDoc(collection(db, 'clients'), {
        name: formData.name,
        phone: formData.phone,
        frequency: 'Manual',
        value: 0,
        services: [],
        productId: '',
        startDate: '',
        endDate: ''
      });
      resetForm();
      return;
    }

    // Com contrato completo — valor = soma dos serviços
    const cleanServices = formData.services.filter(s => s.name.trim() !== '' && s.value !== '');
    const totalValue = cleanServices.reduce((acc, s) => acc + Number(s.value), 0);
    const selectedProd = products.find(p => String(p.id) === String(formData.productId));
    const prodCost = selectedProd ? getTotalCost(selectedProd.costs) : 0;

    const newClientData = {
      name: formData.name,
      phone: formData.phone,
      frequency: formData.frequency,
      productId: String(formData.productId),
      services: cleanServices,
      value: totalValue,
      startDate: new Date(formData.startDate + 'T12:00:00').toISOString(),
      endDate: new Date(formData.endDate + 'T12:00:00').toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'clients'), newClientData);
    const newClient = { ...newClientData, id: docRef.id };

    // Salvar contrato separado
    await addDoc(collection(db, 'contracts'), {
      clientId: docRef.id,
      services: cleanServices,
      value: totalValue,
      frequency: formData.frequency,
      productId: String(formData.productId),
      startDate: newClientData.startDate,
      endDate: newClientData.endDate,
      createdAt: new Date().toISOString()
    });

    if (autoGerar) {
      const newInvoices = generateInvoicesForClient(newClient, prodCost);
      for(let inv of newInvoices) {
         await addDoc(collection(db, 'invoices'), inv);
      }
      alert('Cliente cadastrado e cobranças geradas com sucesso!');
    } else {
      alert('Cliente cadastrado! As cobranças não foram geradas automaticamente.');
    }
    resetForm();
  };

  const handleDeleteClient = async (id) => {
    await deleteDoc(doc(db, 'clients', String(id)));
  };

  if (viewingClient) {
    return <ClientDetailView client={viewingClient} setViewingClient={setViewingClient} invoices={invoices} contracts={contracts} products={products} />
  }

  return (
    <div className="fade-in">
      <div className="top-header">
         <h1>Gerenciar <span>Clientes</span></h1>
         <button className="btn" onClick={() => setShowForm(!showForm)}><Plus size={18} /> Novo Contrato</button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <h3 style={{ marginBottom: 0, marginRight: 'auto' }}>Cadastrar Cliente</h3>
            <button type="button" className={`btn ${formMode === 'simples' ? '' : 'btn-secondary'}`} style={{ padding: '6px 16px', fontSize: '0.85rem' }} onClick={() => setFormMode('simples')}>Somente Cadastrar</button>
            <button type="button" className={`btn ${formMode === 'contrato' ? '' : 'btn-secondary'}`} style={{ padding: '6px 16px', fontSize: '0.85rem' }} onClick={() => setFormMode('contrato')}>Com Contrato</button>
          </div>

          <form onSubmit={handleAddClient} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Nome da Empresa / Cliente</label>
              <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp (com DDD)</label>
              <input type="text" className="form-input" placeholder="Ex: 85999999999" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>

            {formMode === 'contrato' && (
              <>
                <div className="form-group">
                  <label className="form-label">Pacote Base (opcional)</label>
                  <select className="form-select" value={formData.productId} onChange={e => {
                    setFormData({...formData, productId: e.target.value})
                  }}>
                    <option value="">Nenhum / Manual</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de Pagamento</label>
                  <select className="form-select" required value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})}>
                    <option value="Semanal">Semanal</option>
                    <option value="Quinzenal">Quinzenal</option>
                    <option value="Mensal">Mensal</option>
                  </select>
                </div>

                {/* Serviços itemizados */}
                <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Serviços Contratados e Valores</label>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={addServiceLine}>
                      <Plus size={13} /> Adicionar Serviço
                    </button>
                  </div>
                  {formData.services.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '20px' }}>#{idx+1}</span>
                      <input type="text" required className="form-input" placeholder="Ex: Social Media, Tráfego Pago..." value={s.name} onChange={e => updateService(idx, 'name', e.target.value)} style={{ flex: 2 }} />
                      <input type="number" required className="form-input" placeholder="R$" value={s.value} onChange={e => updateService(idx, 'value', e.target.value)} style={{ flex: 1, maxWidth: '130px' }} />
                      {formData.services.length > 1 && (
                        <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} onClick={e => removeServiceLine(e, idx)}>
                          <Minus size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total do Contrato:</span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)' }}>{formatCurrency(totalServicos)}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Início do Contrato</label>
                  <input type="date" className="form-input" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fim do Contrato (Previsão)</label>
                  <input type="date" className="form-input" required value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </>
            )}

            {formMode === 'contrato' && (
              <div style={{ gridColumn: 'span 2', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Gerar cobranças automaticamente?</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {autoGerar
                      ? 'O sistema vai criar todas as cobranças com base no período e frequência do contrato.'
                      : 'O cliente será cadastrado sem nenhuma cobrança. Você cria manualmente no perfil dele.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoGerar(p => !p)}
                  style={{
                    padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                    background: autoGerar ? 'var(--success)' : 'rgba(255,255,255,0.08)',
                    color: autoGerar ? '#064e3b' : 'var(--text-muted)',
                    transition: 'all 0.2s'
                  }}
                >
                  {autoGerar ? '✓ Sim, gerar' : '✗ Não gerar'}
                </button>
              </div>
            )}

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn">
                {formMode === 'simples' ? 'Cadastrar Cliente' : (autoGerar ? 'Salvar e Gerar Carnê' : 'Salvar sem Gerar Cobranças')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
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
                    <div style={{display:'flex', flexDirection: 'column', gap: '4px'}}>
                      {c.services && c.services.length > 0
                        ? c.services.map((s, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.82rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{s.name}</span>
                              <span style={{ fontWeight: 600, color: 'var(--success)', whiteSpace: 'nowrap' }}>{formatCurrency(s.value)}</span>
                            </div>
                          ))
                        : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sem serviços cadastrados</span>
                      }
                      {c.services && c.services.length > 1 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Total</span>
                          <span style={{ fontWeight: 700 }}>{formatCurrency(c.value)}</span>
                        </div>
                      )}
                      <span className="badge" style={{ display: 'inline-block', width: 'fit-content', marginTop: '2px' }}>{c.frequency || 'Manual'}</span>
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
  const [contracts, setContracts] = useState([]);

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

    const unsubContracts = onSnapshot(collection(db, 'contracts'), snapshot => {
      setContracts(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => {
      unsubProducts();
      unsubClients();
      unsubInvoices();
      unsubContracts();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => handleLogin(false)} />
      <main className="main-content" style={{ overflowX: 'hidden' }}>
        {activeTab === 'dashboard' && <Dashboard clients={clients} invoices={invoices} contracts={contracts} products={products} />}
        {activeTab === 'invoices' && <InvoicesTab clients={clients} invoices={invoices} />}
        {activeTab === 'clients' && <ClientsTab clients={clients} products={products} invoices={invoices} contracts={contracts} />}
        {activeTab === 'products' && <ProductsTab products={products} />}
      </main>
    </div>
  );
}

export default App;
