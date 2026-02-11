// Force Rebuild
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Users, 
  Tv, 
  DollarSign, 
  Calendar,
  UserPlus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import { supabase } from './supabaseClient';

// --- Componentes de UI ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 ${className}`}>
    {children}
  </div>
);

const App = () => {
  // --- Estado ---
  const [currentDate, setCurrentDate] = useState(new Date()); // [NEW] Track selected month
  const [services, setServices] = useState([]);
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- Estado de UI ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddService, setShowAddService] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  
  // --- Filtros de Reportes ---
  const [reportFilterMember, setReportFilterMember] = useState('all');
  const [reportFilterYear, setReportFilterYear] = useState(new Date().getFullYear().toString());

  // Forms
  const [newService, setNewService] = useState({ name: '', cost: '' });
  const [newMember, setNewMember] = useState({ name: '' });

  // ... (Data fetching logic unchanged) ...
  // [NOTE: Keeping fetchData and useEffect as is, they are fine]

  // --- Lógica de Supabase ---
  const fetchData = async () => {
    try {
      const { data: membersData } = await supabase.from('members').select('*').order('created_at');
      const { data: servicesData } = await supabase.from('services').select('*').order('created_at');
      const { data: paymentsData } = await supabase.from('payments').select('*').order('date', { ascending: false }); // Sort by date desc

      if (membersData) setMembers(membersData);
      if (servicesData) {
        // Mapear member_ids (snake_case en DB) a memberIds (camelCase en app)
        const formattedServices = servicesData.map(s => ({
            ...s,
            memberIds: s.member_ids || []
        }));
        setServices(formattedServices);
      }
      if (paymentsData) setPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Lógica de Cálculos ---
  // [MODIFIED] Derive string from state
  const currentMonth = currentDate.toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  // [NEW] Handlers for navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
  };

  // --- Lógica de Reportes ---
  const uniqueYears = useMemo(() => {
    const years = new Set([new Date().getFullYear().toString()]);
    payments.forEach(p => {
        // Try to extract year from the 'month' string (e.g. "febrero de 2026")
        const match = p.month.match(/\d{4}/);
        if (match) years.add(match[0]);
    });
    return Array.from(years).sort().reverse();
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
        const matchesMember = reportFilterMember === 'all' || p.member_id === reportFilterMember;
        const matchesYear = p.month.includes(reportFilterYear);
        return matchesMember && matchesYear;
    });
  }, [payments, reportFilterMember, reportFilterYear]);

  // ... (Stats useMemo logic unchanged, it depends on currentMonth which is now dynamic) ...
  const stats = useMemo(() => {
    const totalCost = services.reduce((acc, s) => acc + Number(s.cost), 0);
    
    // Calcular lo que debe cada miembro
    const memberDebts = members.map(member => {
      let totalDue = 0;
      const memberServices = services.filter(s => s.memberIds.includes(member.id));
      
      memberServices.forEach(s => {
        totalDue += Number(s.cost) / (s.memberIds.length || 1);
      });

      const hasPaid = payments.find(p => 
        p.member_id === member.id && 
        p.month === currentMonth
      );

      return {
        ...member,
        totalDue: totalDue.toFixed(2),
        paid: !!hasPaid,
        paymentDate: hasPaid?.date || null
      };
    });

    return { totalCost, memberDebts };
  }, [services, members, payments, currentMonth]);

  // ... (Actions unchanged) ... 
  
  // [MODIFIED] togglePayment uses currentMonth, which is correct for backtracking

  // ... (Rest of actions) ...

  const addService = async (e) => {
    e.preventDefault();
    if (!newService.name || !newService.cost) return;

    const { data, error } = await supabase
        .from('services')
        .insert([{ name: newService.name, cost: Number(newService.cost), member_ids: [] }])
        .select();

    if (error) {
        console.error(error);
        alert(`Error: ${error.message}`);
    } else {
        setServices([...services, { ...data[0], memberIds: [] }]);
        setNewService({ name: '', cost: '' });
        setShowAddService(false);
    }
  };

  const removeService = async (id) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) alert(`Error deleting: ${error.message}`);
    else {
        setServices(services.filter(s => s.id !== id));
    }
  };

  const addMember = async (e) => {
    e.preventDefault();
    if (!newMember.name) return;

    const { data, error } = await supabase
        .from('members')
        .insert([{ name: newMember.name }])
        .select();

    if (error) {
        console.error(error);
        alert(`Error al guardar miembro: ${error.message}`);
    } else {
        setMembers([...members, data[0]]);
        setNewMember({ name: '' });
        setShowAddMember(false);
    }
  };

  const removeMember = async (id) => {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) alert(`Error deleting: ${error.message}`);
    else {
        setMembers(members.filter(m => m.id !== id));
        // Recargar servicios para limpiar el ID huerfano si fuera necesario, 
        // o hacerlo localmente:
        setServices(services.map(s => ({
            ...s,
            memberIds: s.memberIds.filter(mid => mid !== id)
        })));
    }
  };

  const toggleMemberInService = async (serviceId, memberId) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    const exists = service.memberIds.includes(memberId);
    const newMemberIds = exists 
        ? service.memberIds.filter(id => id !== memberId)
        : [...service.memberIds, memberId];

    // Optimistic Update
    setServices(services.map(s => s.id === serviceId ? { ...s, memberIds: newMemberIds } : s));

    const { error } = await supabase
        .from('services')
        .update({ member_ids: newMemberIds })
        .eq('id', serviceId);

    if (error) {
        console.error('Error updating service:', error);
        alert(`Error actualizando servicio: ${error.message}`);
        // Revertir si hay error
        setServices(services.map(s => s.id === serviceId ? service : s));
    }
  };

  const togglePayment = async (memberId) => {
    const existingPayment = payments.find(p => p.member_id === memberId && p.month === currentMonth);

    if (existingPayment) {
        // Eliminar pago
        const { error } = await supabase.from('payments').delete().eq('id', existingPayment.id);
        if (!error) {
            setPayments(payments.filter(p => p.id !== existingPayment.id));
        }
    } else {
        // Crear pago
        const newPayment = {
            member_id: memberId,
            month: currentMonth,
            date: new Date().toLocaleDateString('es-MX') // Payment DATE is always TODAY (audit trail)
        };
        const { data, error } = await supabase.from('payments').insert([newPayment]).select();
        if (!error) {
            setPayments([...payments, data[0]]);
        }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Control de Streaming</h1>
            <div className="flex items-center gap-2 mt-1">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ChevronLeft size={20} className="text-slate-500" />
                </button>
                <p className="text-slate-500 dark:text-slate-400 font-medium capitalize min-w-[140px] text-center select-none">
                    {currentMonth}
                </p>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ChevronRight size={20} className="text-slate-500" />
                </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-100'}`}
            >
              Resumen
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'reports' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-100'}`}
            >
              Reportes
            </button>
            <button 
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'manage' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-100'}`}
            >
              Configurar
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Costo Total</p>
                  <p className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</p>
                </div>
              </Card>
              <Card className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Miembros</p>
                  <p className="text-2xl font-bold">{members.length}</p>
                </div>
              </Card>
              <Card className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full">
                  <Tv size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Servicios</p>
                  <p className="text-2xl font-bold">{services.length}</p>
                </div>
              </Card>
            </div>

            {/* Payment Table */}
            <Card>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calendar size={20} /> Estado de Pagos
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="pb-3 font-medium text-slate-500">Miembro</th>
                      <th className="pb-3 font-medium text-slate-500 text-right">Cuota Sugerida</th>
                      <th className="pb-3 font-medium text-slate-500 text-center">Estado</th>
                      <th className="pb-3 font-medium text-slate-500">Fecha Pago</th>
                      <th className="pb-3 font-medium text-slate-500 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stats.memberDebts.map(member => (
                      <tr key={member.id} className="group">
                        <td className="py-4 font-medium">{member.name}</td>
                        <td className="py-4 text-right font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                          ${member.totalDue}
                        </td>
                        <td className="py-4">
                          <div className="flex justify-center">
                            {member.paid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <CheckCircle size={12} /> Pagado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                <XCircle size={12} /> Pendiente
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-slate-500 text-sm">
                          {member.paymentDate || '---'}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => togglePayment(member.id)}
                            className={`text-sm px-3 py-1 rounded-md transition-colors ${
                              member.paid 
                              ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' 
                              : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                            }`}
                          >
                            {member.paid ? 'Anular' : 'Marcar Pago'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500 italic">
                          No hay miembros registrados. Ve a "Configurar" para añadir personas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Breakdown per service */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-lg font-semibold mb-4">Detalle por Servicio</h3>
                <div className="space-y-4">
                  {services.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.memberIds.length} miembros</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${s.cost}</p>
                        <p className="text-xs text-indigo-500">
                          ${(Number(s.cost) / (s.memberIds.length || 1)).toFixed(2)} c/u
                        </p>
                      </div>
                    </div>
                  ))}
                  {services.length === 0 && <p className="text-slate-500 text-sm italic">Sin servicios registrados.</p>}
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold mb-4">Próximos Pasos</h3>
                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex gap-2">
                    <ArrowRight size={16} className="text-indigo-500 shrink-0" />
                    Asegúrate de que todos los miembros estén asignados a sus respectivos servicios.
                  </li>
                  <li className="flex gap-2">
                    <ArrowRight size={16} className="text-indigo-500 shrink-0" />
                    Las cuotas se calculan dividiendo el costo del servicio entre el número de participantes del mismo.
                  </li>
                  <li className="flex gap-2">
                    <ArrowRight size={16} className="text-indigo-500 shrink-0" />
                    Puedes dar de baja servicios o miembros en la pestaña de configuración.
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
            <div className="space-y-6">
                <Card>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FileText size={20} /> Historial de Pagos
                        </h2>
                        <div className="flex gap-2">
                            <select 
                                value={reportFilterMember} 
                                onChange={(e) => setReportFilterMember(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            >
                                <option value="all">Todos los miembros</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <select 
                                value={reportFilterYear} 
                                onChange={(e) => setReportFilterYear(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            >
                                {uniqueYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="pb-3 font-medium text-slate-500">Fecha de Registro</th>
                                    <th className="pb-3 font-medium text-slate-500">Mes Pagado</th>
                                    <th className="pb-3 font-medium text-slate-500">Miembro</th>
                                    <th className="pb-3 font-medium text-slate-500 text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredPayments.map(payment => {
                                    const memberName = members.find(m => m.id === payment.member_id)?.name || 'Desconocido';
                                    return (
                                        <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                            <td className="py-3 text-slate-600 dark:text-slate-400 font-mono text-sm">{payment.date}</td>
                                            <td className="py-3 font-medium capitalize">{payment.month}</td>
                                            <td className="py-3">{memberName}</td>
                                            <td className="py-3 text-right">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                    <CheckCircle size={12} /> Pagado
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredPayments.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="py-8 text-center text-slate-500 italic">
                                            No se encontraron pagos con los filtros seleccionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        )}

        {activeTab === 'manage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Manage Services */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Tv size={20} /> Servicios
                </h2>
                <button 
                  onClick={() => setShowAddService(!showAddService)}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus size={20} />
                </button>
              </div>

              {showAddService && (
                <Card className="border-indigo-200 dark:border-indigo-900 bg-indigo-50/30">
                  <form onSubmit={addService} className="space-y-3" autoComplete="off">
                    <input 
                      type="text" 
                      name="service_name_input"
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="Nombre (ej. Netflix)" 
                      className="w-full px-3 py-2 rounded-md border border-slate-300 dark:bg-slate-900"
                      value={newService.name}
                      onChange={e => setNewService({...newService, name: e.target.value})}
                    />
                    <input 
                      type="number" 
                      name="service_cost_input"
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="Costo Mensual" 
                      className="w-full px-3 py-2 rounded-md border border-slate-300 dark:bg-slate-900"
                      value={newService.cost}
                      onChange={e => setNewService({...newService, cost: e.target.value})}
                    />
                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-md text-sm font-medium">Guardar</button>
                      <button type="button" onClick={() => setShowAddService(false)} className="px-4 py-2 border border-slate-300 rounded-md text-sm">Cancelar</button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="space-y-3">
                {services.map(s => (
                  <Card key={s.id} className="relative">
                    <button 
                      onClick={() => removeService(s.id)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                    <h3 className="font-bold text-lg">{s.name}</h3>
                    <p className="text-indigo-600 font-bold mb-4">${s.cost} / mes</p>
                    
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Miembros en este servicio:</p>
                      <div className="flex flex-wrap gap-2">
                        {members.map(m => {
                          const isActive = s.memberIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              onClick={() => toggleMemberInService(s.id, m.id)}
                              className={`text-xs px-2 py-1 rounded-full border transition-all ${
                                isActive 
                                ? 'bg-indigo-600 border-indigo-600 text-white' 
                                : 'bg-transparent border-slate-300 text-slate-500'
                              }`}
                            >
                              {m.name}
                            </button>
                          );
                        })}
                      </div>
                      {members.length === 0 && <p className="text-xs text-slate-400 italic">No hay miembros registrados.</p>}
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* Manage Members */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users size={20} /> Miembros
                </h2>
                <button 
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <UserPlus size={20} />
                </button>
              </div>

              {showAddMember && (
                <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/30">
                  <form onSubmit={addMember} className="space-y-3" autoComplete="off">
                    <input 
                      type="text" 
                      name="member_name_input"
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="Nombre del miembro" 
                      className="w-full px-3 py-2 rounded-md border border-slate-300 dark:bg-slate-900"
                      value={newMember.name}
                      onChange={e => setNewMember({name: e.target.value})}
                    />
                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-md text-sm font-medium">Añadir</button>
                      <button type="button" onClick={() => setShowAddMember(false)} className="px-4 py-2 border border-slate-300 rounded-md text-sm">Cancelar</button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-medium">{m.name}</span>
                    <button 
                      onClick={() => removeMember(m.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-center py-8 text-slate-500 italic">Sin miembros. Haz clic en el + para añadir.</p>
                )}
              </div>
            </section>
          </div>
        )}

        <p className="text-xs text-slate-400 text-center mt-12 mb-4">
          Control de Streaming v1.1 - Conectado
        </p>
      </div>
    </div>
  );
};

export default App;