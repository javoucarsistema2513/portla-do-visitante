import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Church, 
  UserPlus, 
  FileText, 
  LogOut, 
  Phone, 
  MapPin, 
  User, 
  Download,
  Search,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Baby,
  Trash2,
  Pencil,
  X,
  ChevronRight,
  Sparkles,
  Users,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { visitorService } from './services/visitorService';
import { userService, UserProfile } from './services/userService';
import { Visitor } from './types';
import { User as SupabaseUser } from '@supabase/supabase-js';

const PDFReportGenerator = (visitors: Visitor[], category: string, period: string) => {
  const doc = new jsPDF();
  
  const categoryLabel = category === 'todas' ? 'Toda Equipe' : category === 'homens' ? 'Homens' : category === 'mulheres' ? 'Mulheres' : 'Jovens';
  const periodLabel = period === 'all' ? 'Todos' : period === 'weekly' ? 'Últimos 7 dias' : 'Últimos 30 dias';

  doc.setFontSize(20);
  doc.text(`Relatório: ${categoryLabel}`, 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Período: ${periodLabel} | Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
  
  const tableData = visitors.map((v, i) => {
    let dateStr = '-';
    try {
      if (v.createdAt) {
        if (typeof v.createdAt === 'object' && v.createdAt.seconds) {
          dateStr = new Date(v.createdAt.seconds * 1000).toLocaleDateString('pt-BR');
        } else {
          dateStr = new Date(v.createdAt).toLocaleDateString('pt-BR');
        }
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }

    const visitorAge = v.age || (v.birthDate ? calculateAge(v.birthDate) : '-');

    return [
      i + 1,
      v.name,
      v.phone,
      v.category ? v.category.charAt(0).toUpperCase() + v.category.slice(1) : '-',
      visitorAge,
      v.gender || '-',
      v.birthDate || '-',
      v.participatesInCell === 'sim' ? `Sim ${v.cellLeader ? '(' + v.cellLeader + ')' : ''}` : v.participatesInCell === 'nao' ? `Não ${v.invitedBy ? '(Conv: ' + v.invitedBy + ')' : ''}` : '-',
      v.isMarriedOrLivesTogether === 'sim' ? 'Sim' : v.isMarriedOrLivesTogether === 'nao' ? 'Não' : '-',
      v.prayerRequest || '-',
      v.address,
      dateStr
    ];
  });
  
  autoTable(doc, {
    startY: 35,
    head: [['#', 'Nome', 'Telefone', 'Grupo', 'Idade', 'Sexo', 'Nasc.', 'Célula/Convidado', 'Mora Junto', 'Pedido Oração', 'Endereço', 'Data de Reg.']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 138] },
    styles: { fontSize: 7 }
  });
  
  doc.save(`relatorio-${category}-${period}.pdf`);
};

const calculateAge = (birthDate: string) => {
  if (!birthDate || !birthDate.includes('/')) return '-';
  const parts = birthDate.split('/');
  if (parts.length !== 3) return '-';
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year || year < 1000) return '-';
  
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age.toString() : '-';
};

const CSVReportGenerator = (visitors: Visitor[], category: string, period: string) => {
  const headers = ['Nome', 'Telefone', 'Grupo', 'Idade', 'Sexo', 'Data de Nascimento', 'Participa de Célula', 'Mora Junto/Casado', 'Algum pedido de Oração?', 'Endereço', 'Data de Reg.'];
  const rows = visitors.map(v => {
    let dateStr = '';
    try {
      if (v.createdAt) {
        if (typeof v.createdAt === 'object' && v.createdAt.seconds) {
          dateStr = new Date(v.createdAt.seconds * 1000).toLocaleDateString('pt-BR');
        } else {
          dateStr = new Date(v.createdAt).toLocaleDateString('pt-BR');
        }
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }

    const visitorAge = v.age || (v.birthDate ? calculateAge(v.birthDate) : '');

    return [
      v.name,
      v.phone,
      v.category || '',
      visitorAge,
      v.gender || '',
      v.birthDate || '',
      v.participatesInCell === 'sim' ? `Sim ${v.cellLeader ? '(' + v.cellLeader + ')' : ''}` : (v.participatesInCell === 'nao' ? `Não ${v.invitedBy ? '(Conv: ' + v.invitedBy + ')' : ''}` : v.participatesInCell || ''),
      v.isMarriedOrLivesTogether || '',
      v.prayerRequest ? v.prayerRequest.replace(/,/g, ';').replace(/\n/g, ' ') : '',
      v.address.replace(/,/g, ';'),
      dateStr
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `relatorio-${category}-${period}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'register' | 'list' | 'users'>('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Report filter states
  const [reportPeriod, setReportPeriod] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [reportCategory, setReportCategory] = useState<'homens' | 'mulheres' | 'jovens' | 'todas'>('homens');

  // Admin User Management states
  const [adminNewUserEmail, setAdminNewUserEmail] = useState('');
  const [adminNewUserPassword, setAdminNewUserPassword] = useState('');
  const [adminNewUserDisplayName, setAdminNewUserDisplayName] = useState('');
  const [adminNewUserCategory, setAdminNewUserCategory] = useState<'homens' | 'mulheres' | 'jovens' | 'user'>('user');
  const [adminCreateLoading, setAdminCreateLoading] = useState(false);
  const [adminCreateMessage, setAdminCreateMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const fetchProfiles = async () => {
    setProfilesLoading(true);
    setProfilesError(null);
    try {
      const data = await userService.getProfiles();
      setProfiles(data);
      if (user) {
        const myProfile = data.find(p => p.id === user.id);
        if (myProfile) setCurrentUserProfile(myProfile);
      }
    } catch (err: any) {
      console.error('Erro detalhado ao buscar perfis:', err);
      const errorMessage = err.message || (err.error_description) || JSON.stringify(err);
      setProfilesError(`Erro de acesso: ${errorMessage}. Verifique se a tabela 'profiles' existe e tem políticas RLS ativas no Supabase.`);
    } finally {
      setProfilesLoading(false);
    }
  };

  const handleAdminCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCreateLoading(true);
    setAdminCreateMessage(null);
    try {
      if (editingProfileId) {
        await userService.updateProfile(editingProfileId, {
          display_name: adminNewUserDisplayName,
          admin_category: adminNewUserCategory === 'user' ? null : adminNewUserCategory,
          role: adminNewUserCategory === 'user' ? 'user' : 'admin'
        });
        setAdminCreateMessage({ 
          type: 'success', 
          text: 'Usuário atualizado com sucesso!' 
        });
        setEditingProfileId(null);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: adminNewUserEmail,
          password: adminNewUserPassword,
          options: {
            data: {
              display_name: adminNewUserDisplayName,
              admin_category: adminNewUserCategory === 'user' ? null : adminNewUserCategory,
            }
          }
        });
        if (error) throw error;
        
        if (data.user) {
          await userService.upsertProfile({
            id: data.user.id,
            email: adminNewUserEmail,
            display_name: adminNewUserDisplayName,
            admin_category: adminNewUserCategory === 'user' ? null : adminNewUserCategory,
            role: adminNewUserCategory === 'user' ? 'user' : 'admin'
          });
        }

        setAdminCreateMessage({ 
          type: 'success', 
          text: 'Usuário criado com sucesso! Ele já aparece na lista abaixo.' 
        });
      }
      
      fetchProfiles();
      // Reset form
      setAdminNewUserEmail('');
      setAdminNewUserPassword('');
      setAdminNewUserDisplayName('');
      setAdminNewUserCategory('user');
    } catch (error: any) {
      console.error(error);
      setAdminCreateMessage({ type: 'error', text: error.message || 'Erro ao processar usuário.' });
    } finally {
      setAdminCreateLoading(false);
    }
  };

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [userAdminCategory, setUserAdminCategory] = useState<'homens' | 'mulheres' | 'jovens' | null>(null);

  const currentUserAdminCategory = currentUserProfile?.admin_category || (user?.user_metadata?.admin_category as 'homens' | 'mulheres' | 'jovens' | undefined);
  const isUserAdmin = !!currentUserAdminCategory || user?.email === 'adminnovo@gmail.com' || currentUserProfile?.role === 'admin';
  const effectiveAdminCategory = currentUserAdminCategory || (user?.email === 'adminnovo@gmail.com' ? 'todas' : null);

  // Visitor form states
  const [showCategoryStep, setShowCategoryStep] = useState(true);
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    address: string;
    age: string;
    gender: string;
    birthDate: string;
    participatesInCell: string;
    cellLeader: string;
    category?: 'homens' | 'mulheres' | 'jovens';
    isMarriedOrLivesTogether: string;
    prayerRequest: string;
    invitedBy: string;
  }>({
    name: '',
    phone: '',
    address: '',
    age: '',
    gender: '',
    birthDate: '',
    participatesInCell: '',
    cellLeader: '',
    category: undefined,
    isMarriedOrLivesTogether: '',
    prayerRequest: '',
    invitedBy: ''
  });

  useEffect(() => {
    if (view === 'users' && isUserAdmin) {
      fetchProfiles();
    }
  }, [view, isUserAdmin]);

  useEffect(() => {
    // Check active sessions and sets up the observer
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        visitorService.testConnection();
        fetchVisitors();
        
        // Auto-save current user profile with master admin check
        const isMasterAdmin = session.user.email === 'adminnovo@gmail.com';
        const role = (session.user.user_metadata?.admin_category || isMasterAdmin) ? 'admin' : 'user';
        const category = session.user.user_metadata?.admin_category || null;
        
        let displayName = session.user.user_metadata?.display_name || 'Usuário';
        if (isMasterAdmin) {
          displayName = 'Admin';
        }

        userService.upsertProfile({
          id: session.user.id,
          email: session.user.email || '',
          display_name: displayName,
          admin_category: category,
          role: role
        }).then(() => {
          fetchProfiles();
        }).catch(err => console.error('Erro ao sincronizar perfil:', err));

        setView('home');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        visitorService.testConnection();
        fetchVisitors();
        fetchProfiles();

        // Auto-save current user profile
        const isMasterAdmin = session.user.email === 'adminnovo@gmail.com';
        let displayName = session.user.user_metadata?.display_name || 'Usuário';
        if (isMasterAdmin) {
          displayName = 'Admin';
        }

        userService.upsertProfile({
          id: session.user.id,
          email: session.user.email || '',
          display_name: displayName,
          admin_category: session.user.user_metadata?.admin_category || null,
          role: (session.user.user_metadata?.admin_category || isMasterAdmin) ? 'admin' : 'user'
        });

        setView('home');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchVisitors = async () => {
    try {
      const data = await visitorService.getVisitors();
      if (data) setVisitors(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              admin_category: userRole === 'admin' ? userAdminCategory : null,
            }
          }
        });
        if (error) throw error;

        if (data.user) {
          await userService.upsertProfile({
            id: data.user.id,
            email: email,
            display_name: displayName,
            admin_category: userRole === 'admin' ? userAdminCategory : null,
            role: userRole === 'admin' ? 'admin' : 'user'
          });
        }

        setAuthError('Cadastro realizado com sucesso! Você já pode entrar.');
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error(error);
      setAuthError(error.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este usuário da lista? (Isso não remove o acesso dele do Supabase Auth, apenas da lista de gerenciamento)')) return;
    try {
      await userService.deleteProfile(id);
      fetchProfiles();
      setMessage({ type: 'success', text: 'Usuário removido da lista.' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Erro ao remover usuário.' });
    }
  };

  const handleEditProfile = (profile: UserProfile) => {
    setEditingProfileId(profile.id);
    setAdminNewUserEmail(profile.email);
    setAdminNewUserDisplayName(profile.display_name);
    setAdminNewUserCategory(profile.admin_category || 'user');
    setAdminNewUserPassword('********'); // Placeholder since we can't edit password
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteVisitor = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este visitante?')) return;
    
    try {
      await visitorService.deleteVisitor(id);
      setMessage({ type: 'success', text: 'Visitante removido com sucesso!' });
      fetchVisitors();
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Erro ao remover visitante.' });
    }
  };

  const handleEditVisitor = (visitor: Visitor) => {
    let bDate = visitor.birthDate || '';
    if (bDate && bDate.includes('-')) {
      const [y, m, d] = bDate.split('-');
      if (y && y.length === 4) {
        bDate = `${d}/${m}/${y}`;
      }
    }

    setEditingId(visitor.id || null);
    setFormData({
      name: visitor.name,
      phone: visitor.phone,
      address: visitor.address,
      age: visitor.age?.toString() || '',
      gender: visitor.gender || '',
      birthDate: bDate,
      participatesInCell: visitor.participatesInCell || '',
      cellLeader: visitor.cellLeader || '',
      invitedBy: visitor.invitedBy || '',
      category: visitor.category,
      isMarriedOrLivesTogether: visitor.isMarriedOrLivesTogether || '',
      prayerRequest: visitor.prayerRequest || ''
    });
    setShowCategoryStep(false);
    setView('register');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowCategoryStep(true);
    setFormData({ name: '', phone: '', address: '', age: '', gender: '', birthDate: '', participatesInCell: '', cellLeader: '', category: undefined, isMarriedOrLivesTogether: '', prayerRequest: '', invitedBy: '' });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const visitorData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : undefined
      };

      if (editingId) {
        await visitorService.updateVisitor(editingId, visitorData);
        setMessage({ type: 'success', text: 'Visitante atualizado com sucesso!' });
      } else {
        await visitorService.addVisitor(visitorData, user?.id);
        setMessage({ type: 'success', text: 'Visitante cadastrado com sucesso!' });
      }

      setFormData({ name: '', phone: '', address: '', age: '', gender: '', birthDate: '', participatesInCell: '', cellLeader: '', category: undefined, isMarriedOrLivesTogether: '', prayerRequest: '', invitedBy: '' });
      setEditingId(null);
      setShowCategoryStep(true);
      fetchVisitors();
      
      // Scroll to top to see success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Submit Error:', error);
      setMessage({ type: 'error', text: editingId ? 'Erro ao atualizar visitante.' : 'Erro ao cadastrar visitante.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateReport = (type: 'pdf' | 'csv') => {
    let filtered = [...visitors];

    // Filter by category
    if (reportCategory !== 'todas') {
      filtered = filtered.filter(v => v.category === reportCategory);
    }

    // Filter by period
    if (reportPeriod !== 'all') {
      const now = new Date();
      const limitDate = new Date();
      if (reportPeriod === 'weekly') {
        limitDate.setDate(now.getDate() - 7);
      } else if (reportPeriod === 'monthly') {
        limitDate.setDate(now.getDate() - 30);
      }

      filtered = filtered.filter(v => {
        if (!v.createdAt) return false;
        const date = v.createdAt.seconds ? new Date(v.createdAt.seconds * 1000) : new Date(v.createdAt);
        return date >= limitDate;
      });
    }

    if (filtered.length === 0) {
      alert('Nenhum visitante encontrado para os filtros selecionados.');
      return;
    }

    if (type === 'pdf') {
      PDFReportGenerator(filtered, reportCategory, reportPeriod);
    } else {
      CSVReportGenerator(filtered, reportCategory, reportPeriod);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Image for Login Screen */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=2070" 
            alt="Pessoas unidas em círculo com mãos ao centro" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-blue-900/10" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-5 sm:p-8 max-w-[310px] sm:max-w-[380px] w-full mx-auto border border-white/50"
        >
          <div className="bg-blue-100 w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4">
            <Church className="text-blue-600 w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          
          <h1 className="text-2xl sm:text-4xl font-black text-gray-900 text-center mb-1 tracking-tighter">Consolidação</h1>
          <p className="text-blue-600 font-bold text-center mb-4 sm:mb-6 text-[9px] sm:text-[12px] uppercase tracking-[0.2em] px-3 py-1 bg-blue-50 rounded-lg w-fit mx-auto">Novo na Igreja</p>

          <form onSubmit={handleEmailAuth} className="space-y-2.5 sm:space-y-4">
            {authError && (
              <div className="p-2 sm:p-3 rounded-lg bg-red-50 text-red-600 text-[11px] sm:text-sm border border-red-100 italic font-medium">
                {authError}
              </div>
            )}

            {authMode === 'signup' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5 ml-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    required
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                    className="input-field pl-10 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {authMode === 'signup' && (
              <div className="space-y-3 pt-1 border-t border-gray-100">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tipo de Conta</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setUserRole('user')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100`}
                    >
                      Visitador
                    </button>
                  </div>
                </div>

                {userRole === 'admin' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Admin de:</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['homens', 'mulheres', 'jovens'] as const).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setUserAdminCategory(cat)}
                          className={`py-1.5 px-1 rounded-lg text-[9px] font-black uppercase tracking-tight border-2 transition-all ${userAdminCategory === cat ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5 ml-1">E-mail</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  required
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@igreja.com"
                  className="input-field pl-10 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5 ml-1">Senha</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  required
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 py-2 text-sm"
                />
              </div>
            </div>

            <button 
              disabled={authLoading}
              className="w-full btn-primary h-9 sm:h-11 flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Entrar'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row h-screen h-[100dvh] overflow-hidden bg-white sm:bg-slate-50 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden sm:flex flex-col w-20 lg:w-64 bg-white border-r border-slate-200 shrink-0 z-30">
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-50">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <Church className="w-6 h-6" />
          </div>
          <h1 className="font-black text-lg text-slate-800 hidden lg:block truncate">Sistema</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setView('home')}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${view === 'home' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
          >
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <span className="font-bold text-sm hidden lg:block">Início</span>
          </button>
          <button 
            onClick={() => {
              setView('register');
              setShowCategoryStep(true);
              handleCancelEdit();
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${view === 'register' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
          >
            <UserPlus className="w-6 h-6 shrink-0" />
            <span className="font-bold text-sm hidden lg:block">Novo Visitante</span>
          </button>
            {isUserAdmin && (
              <button 
                onClick={() => {
                  setView('list');
                  setReportCategory(effectiveAdminCategory as any);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
              >
                <FileText className="w-6 h-6 shrink-0" />
                <span className="font-bold text-sm hidden lg:block">Relatórios</span>
              </button>
            )}
            {isUserAdmin && (
              <button 
                onClick={() => setView('users')}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${view === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
              >
                <Users className="w-6 h-6 shrink-0" />
                <span className="font-bold text-sm hidden lg:block">Usuários</span>
              </button>
            )}
        </nav>

        <div className="p-4 border-t border-slate-50 shrink-0">
          <div className="bg-slate-50 p-3 rounded-2xl mb-3 hidden lg:block">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Usuário Logado</p>
            <p className="text-xs font-bold text-slate-700 truncate">{currentUserProfile?.display_name || user.user_metadata?.display_name || user.email || 'Usuário'}</p>
            <p className="text-[9px] font-black text-blue-500 uppercase mt-1">
              {isUserAdmin ? `Admin ${effectiveAdminCategory || ''}` : 'Visitador'}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
          >
            <LogOut className="w-6 h-6 shrink-0" />
            <span className="font-bold text-sm hidden lg:block">Sair do App</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header - Mobile */}
        {view !== 'home' && (
          <header className="sm:hidden flex bg-white/90 backdrop-blur-lg border-b border-slate-100 h-14 shrink-0 z-20 px-4 items-center justify-between sticky top-0">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                <Church className="w-5 h-5" />
              </div>
              <h1 className="font-black text-base text-slate-900 tracking-tight">IPCC.</h1>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </header>
        )}

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-y-auto px-0 py-0 relative h-full">
          <AnimatePresence mode="wait">
            {view === 'home' ? (
              <motion.div 
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative min-h-full w-full flex flex-col items-center justify-between text-center"
              >
                {/* Background Image - Full Screen App Look */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                   <img 
                    src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=2070" 
                    alt="Pessoas unidas em círculo com mãos ao centro" 
                    className="w-full h-full object-cover"
                  />
                  {/* Reduced overlay for maximum image impact */}
                  <div className="absolute inset-0 bg-blue-900/5" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/5 to-blue-900/30" />
                </div>

                {/* Top Actions (Minimalist) */}
                <div className="relative z-10 w-full p-6 flex justify-end">
                  <button 
                    onClick={handleLogout}
                    className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white/80 hover:bg-white/20 active:scale-95 transition-all border border-white/10"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>

                {/* Centered Content */}
                <div className="relative z-10 w-full max-w-sm px-6 pb-24 sm:pb-20">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="mb-12 w-fit mx-auto text-left"
                  >
                    <div className="bg-white/10 backdrop-blur-2xl p-5 rounded-[2rem] w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mb-8 border border-white/20 shadow-2xl">
                      <Church className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                    </div>
                    <h2 className="text-4xl sm:text-7xl font-black text-white mb-4 tracking-tighter uppercase leading-none drop-shadow-xl">
                      Consolidação
                    </h2>
                    <div className="w-fit px-4 py-2 bg-blue-500/20 backdrop-blur-md rounded-full border border-blue-400/30">
                      <p className="text-xs sm:text-sm font-black text-blue-100 tracking-[0.4em] uppercase">
                        Novo na Igreja
                      </p>
                    </div>
                  </motion.div>

                  <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => {
                      setView('register');
                      setShowCategoryStep(true);
                      handleCancelEdit();
                    }}
                    className="w-full bg-white text-blue-950 h-16 rounded-[2rem] font-black text-xl uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-3 group"
                  >
                    Iniciar
                    <div className="bg-blue-950/10 p-2 rounded-full group-hover:translate-x-1 transition-transform">
                      <UserPlus className="w-6 h-6" />
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <div className="px-4 py-4 sm:px-10 sm:py-12 pb-20 sm:pb-12 max-w-4xl mx-auto w-full">
                {view === 'register' ? (
                  <motion.div 
                    key="register"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-8"
                >
                  <div className="mb-2 px-1 flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-1 tracking-tighter">
                        {editingId ? 'Editar Visitante' : 'Cadastrar Visitante'}
                      </h2>
                      <p className="text-slate-500 text-xs sm:text-sm font-medium tracking-tight">
                        {editingId ? 'Corrija as informações necessárias.' : 'Registre as informações para o banco de dados.'}
                      </p>
                    </div>
                    {editingId && (
                      <button 
                        onClick={handleCancelEdit}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                      >
                        <X className="w-4 h-4" />
                        Cancelar Edição
                      </button>
                    )}
                  </div>

                  <div className="card-native p-4 sm:p-10 transform transition-all duration-500 hover:shadow-2xl hover:shadow-blue-900/5">
                    {showCategoryStep && !editingId ? (
                      <div className="space-y-8 py-4">
                        <div className="text-center">
                          <h3 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">Selecione o Grupo</h3>
                          <p className="text-slate-500 text-sm font-medium">Para quem é este cadastro?</p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 sm:gap-6 max-w-sm mx-auto">
                          <button
                            onClick={() => {
                              setFormData(prev => ({ ...prev, category: 'homens', gender: 'M' }));
                              setShowCategoryStep(false);
                            }}
                            className="bg-white border-2 border-slate-100 hover:border-blue-600 hover:bg-blue-50/50 p-6 rounded-[2rem] flex items-center justify-between group transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="bg-blue-100 p-3 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <User className="w-6 h-6" />
                              </div>
                              <span className="font-black text-lg text-slate-700 group-hover:text-blue-700">Homens</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                          </button>

                          <button
                            onClick={() => {
                              setFormData(prev => ({ ...prev, category: 'mulheres', gender: 'F' }));
                              setShowCategoryStep(false);
                            }}
                            className="bg-white border-2 border-slate-100 hover:border-pink-600 hover:bg-pink-50/50 p-6 rounded-[2rem] flex items-center justify-between group transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="bg-pink-100 p-3 rounded-2xl group-hover:bg-pink-600 group-hover:text-white transition-colors">
                                <User className="w-6 h-6" />
                              </div>
                              <span className="font-black text-lg text-slate-700 group-hover:text-pink-700">Mulheres</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-pink-500 group-hover:translate-x-1 transition-all" />
                          </button>

                          <button
                            onClick={() => {
                              setFormData(prev => ({ ...prev, category: 'jovens' }));
                              setShowCategoryStep(false);
                            }}
                            className="bg-white border-2 border-slate-100 hover:border-violet-600 hover:bg-violet-50/50 p-6 rounded-[2rem] flex items-center justify-between group transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="bg-violet-100 p-3 rounded-2xl group-hover:bg-violet-600 group-hover:text-white transition-colors">
                                <Sparkles className="w-6 h-6" />
                              </div>
                              <span className="font-black text-lg text-slate-700 group-hover:text-violet-700">Jovens</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className={`mb-8 p-5 rounded-2xl flex items-center gap-4 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                          >
                            {message.type === 'success' && <CheckCircle2 className="w-6 h-6 shrink-0" />}
                            <span className="font-bold text-sm">{message.text}</span>
                            <button onClick={() => setMessage(null)} className="ml-auto p-1 bg-white/20 rounded-lg hover:bg-white/40">×</button>
                          </motion.div>
                        )}

                        <form onSubmit={handleFormSubmit} className="space-y-4 sm:space-y-6">
                      <div className="space-y-1 sm:space-y-2">
                        <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Visitante</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 sm:w-5 sm:h-5" />
                          <input 
                            required
                            type="text" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            placeholder="Nome completo do visitante"
                            className="input-field pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-1 sm:space-y-2">
                          <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone Principal</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 sm:w-5 sm:h-5" />
                            <input 
                              required
                              type="tel" 
                              value={formData.phone}
                              onChange={(e) => setFormData({...formData, phone: e.target.value})}
                              placeholder="(00) 00000-0000"
                              className="input-field pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
                        <div className="space-y-1 sm:space-y-2 col-span-2 sm:col-span-1">
                          <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Nasc.</label>
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 sm:w-5 sm:h-5" />
                            <input 
                              type="text" 
                              value={formData.birthDate}
                              onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, '');
                                if (val.length > 8) val = val.slice(0, 8);
                                if (val.length >= 5) {
                                  val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
                                } else if (val.length >= 3) {
                                  val = `${val.slice(0, 2)}/${val.slice(2)}`;
                                }
                                setFormData({...formData, birthDate: val});
                              }}
                              placeholder="DD/MM/AAAA"
                              className="input-field pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base"
                            />
                          </div>
                        </div>
                        <div className="space-y-1 sm:space-y-2 col-span-2 sm:col-span-1">
                          <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo</label>
                          <div className="flex gap-4 p-1">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, gender: 'M'})}
                              className={`flex-1 h-12 sm:h-14 rounded-2xl font-bold transition-all border-2 ${formData.gender === 'M' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                              Masculino
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, gender: 'F'})}
                              className={`flex-1 h-12 sm:h-14 rounded-2xl font-bold transition-all border-2 ${formData.gender === 'F' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                              Feminino
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-1 sm:space-y-2">
                          <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Participa de uma célula?</label>
                          <div className="flex gap-4 p-1">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, participatesInCell: 'sim'})}
                              className={`flex-1 h-12 sm:h-14 rounded-2xl font-bold transition-all border-2 ${formData.participatesInCell === 'sim' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, participatesInCell: 'nao', cellLeader: '', invitedBy: ''})}
                              className={`flex-1 h-12 sm:h-14 rounded-2xl font-bold transition-all border-2 ${formData.participatesInCell === 'nao' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                              Não
                            </button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {formData.participatesInCell === 'sim' && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0, marginTop: -20 }}
                              animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                              exit={{ opacity: 0, height: 0, marginTop: -20 }}
                              className="space-y-1 sm:space-y-2 overflow-hidden"
                            >
                              <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Líder</label>
                              <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 sm:w-5 sm:h-5" />
                                <input 
                                  type="text" 
                                  value={formData.cellLeader}
                                  onChange={(e) => setFormData({...formData, cellLeader: e.target.value})}
                                  placeholder="Nome do líder da célula"
                                  className="input-field pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base"
                                />
                              </div>
                            </motion.div>
                          )}
                          {formData.participatesInCell === 'nao' && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0, marginTop: -20 }}
                              animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                              exit={{ opacity: 0, height: 0, marginTop: -20 }}
                              className="space-y-1 sm:space-y-2 overflow-hidden"
                            >
                              <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">foi convidado por alguém?</label>
                              <div className="relative">
                                <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 sm:w-5 sm:h-5" />
                                <input 
                                  type="text" 
                                  value={formData.invitedBy}
                                  onChange={(e) => setFormData({...formData, invitedBy: e.target.value})}
                                  placeholder="Nome de quem convidou"
                                  className="input-field pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base"
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="space-y-1 sm:space-y-2">
                          <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Mora Junto ou é casado?</label>
                          <div className="flex gap-4 p-1">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, isMarriedOrLivesTogether: 'sim'})}
                              className={`flex-1 h-12 sm:h-14 rounded-2xl font-bold transition-all border-2 ${formData.isMarriedOrLivesTogether === 'sim' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, isMarriedOrLivesTogether: 'nao'})}
                              className={`flex-1 h-12 sm:h-14 rounded-2xl font-bold transition-all border-2 ${formData.isMarriedOrLivesTogether === 'nao' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                              Não
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 sm:space-y-2">
                        <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Algum pedido de Oração?</label>
                        <div className="relative">
                          <FileText className="absolute left-4 top-4 text-slate-300 w-4 h-4 sm:w-5 sm:h-5" />
                          <textarea 
                            rows={3}
                            value={formData.prayerRequest}
                            onChange={(e) => setFormData({...formData, prayerRequest: e.target.value})}
                            placeholder="Escreva aqui o pedido de oração se houver..."
                            className="input-field pl-10 sm:pl-12 pt-3 sm:pt-4 resize-none text-sm sm:text-base"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 sm:space-y-2">
                        <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço Completo</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-4 text-slate-300 w-4 h-4 sm:w-5 sm:h-5" />
                          <textarea 
                            required
                            rows={2}
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            placeholder="Rua, Número, Bairro e Cidade"
                            className="input-field pl-10 sm:pl-12 pt-3 sm:pt-4 resize-none text-sm sm:text-base"
                          />
                        </div>
                      </div>

                      <button 
                        disabled={isSubmitting}
                        className="w-full btn-primary h-14 sm:h-16 group"
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin w-6 h-6" />
                        ) : (
                          <div className="flex items-center gap-2">
                            {editingId ? <CheckCircle2 className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                            <span>{editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
                </motion.div>
              ) : view === 'users' && isUserAdmin ? (
                <motion.div 
                  key="users"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6 sm:space-y-8"
                >
                  <div className="mb-2 px-1">
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-1 tracking-tighter">Usuários</h2>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium tracking-tight">Gerencie os acessos do sistema.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    {/* Create User Form */}
                    <div className="card-native p-6 sm:p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                            <UserPlus className="w-5 h-5" />
                          </div>
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                            {editingProfileId ? 'Editar Acesso' : 'Cadastrar Novo Acesso'}
                          </h3>
                        </div>
                        {editingProfileId && (
                          <button 
                            onClick={() => {
                              setEditingProfileId(null);
                              setAdminNewUserEmail('');
                              setAdminNewUserDisplayName('');
                              setAdminNewUserPassword('');
                              setAdminNewUserCategory('user');
                            }}
                            className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>

                      {adminCreateMessage && (
                        <div className={`mb-6 p-4 rounded-xl text-xs font-bold italic border ${
                          adminCreateMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                        }`}>
                          {adminCreateMessage.text}
                        </div>
                      )}

                      <form onSubmit={handleAdminCreateAccount} className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                          <input 
                            required
                            type="text" 
                            value={adminNewUserDisplayName}
                            onChange={(e) => setAdminNewUserDisplayName(e.target.value)}
                            placeholder="Nome do colaborador"
                            className="input-field py-3"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Acesso</label>
                          <input 
                            required
                            disabled={!!editingProfileId}
                            type="email" 
                            value={adminNewUserEmail}
                            onChange={(e) => setAdminNewUserEmail(e.target.value)}
                            placeholder="exemplo@igreja.com"
                            className="input-field py-3 disabled:opacity-50"
                          />
                          {editingProfileId && <p className="text-[9px] text-slate-400 mt-1 italic">* O e-mail não pode ser alterado aqui.</p>}
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha Inicial</label>
                          <input 
                            required={!editingProfileId}
                            disabled={!!editingProfileId}
                            type="password" 
                            value={adminNewUserPassword}
                            onChange={(e) => setAdminNewUserPassword(e.target.value)}
                            placeholder={editingProfileId ? "••••••••" : "Crie uma senha"}
                            className="input-field py-3 disabled:opacity-50"
                          />
                          {editingProfileId && <p className="text-[9px] text-slate-400 mt-1 italic">* A senha não pode ser alterada aqui.</p>}
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nível de Acesso</label>
                          <div className={`grid gap-2 mt-2 ${user?.email === 'adminnovo@gmail.com' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1'}`}>
                            {(user?.email === 'adminnovo@gmail.com' ? [
                              { id: 'user', label: 'Visitador' },
                              { id: 'homens', label: 'Admin Homem' },
                              { id: 'mulheres', label: 'Admin Mulher' },
                              { id: 'jovens', label: 'Admin Jovem' }
                            ] : [
                              { id: 'user', label: 'Visitador' }
                            ]).map(role => (
                              <button
                                key={role.id}
                                type="button"
                                disabled={user?.email !== 'adminnovo@gmail.com' && role.id !== 'user'}
                                onClick={() => setAdminNewUserCategory(role.id as any)}
                                className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-tighter border-2 transition-all ${
                                  adminNewUserCategory === role.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                }`}
                              >
                                {role.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button 
                          disabled={adminCreateLoading}
                          className="w-full btn-primary h-12 flex items-center justify-center gap-2 mt-4"
                        >
                          {adminCreateLoading ? <Loader2 className="animate-spin w-5 h-5" /> : (editingProfileId ? 'Salvar Alterações' : 'Criar Cadastro')}
                        </button>
                      </form>
                    </div>

                    {/* Current User Info */}
                    <div className="card-native p-6 sm:p-8 bg-slate-900 text-white self-start">
                      <h3 className="text-lg font-black mb-6 uppercase tracking-widest flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-blue-400" />
                        Seu Perfil
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Código</p>
                          <p className="font-mono text-sm font-bold text-blue-400 bg-blue-900/50 px-2 py-1 rounded-md inline-block">
                            {user?.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome</p>
                          <p className="text-xl font-black">{currentUserProfile?.display_name || user?.user_metadata?.display_name || 'Admin'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-mail</p>
                          <p className="text-slate-300 font-medium">{user?.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nível</p>
                          <span className="inline-block px-3 py-1 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mt-1">
                            Administrador {effectiveAdminCategory}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Users List */}
                  <div className="card-native p-6 sm:p-8">
                      <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                          <Users className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Equipe Cadastrada</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={fetchProfiles}
                          disabled={profilesLoading}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50"
                          title="Recarregar lista"
                        >
                          <RefreshCw className={`w-4 h-4 ${profilesLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {profilesError && (
                      <div className="mb-6">
                        <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold italic">
                          {profilesError}
                        </div>
                        <div className="bg-slate-900 p-5 rounded-2xl text-slate-300 font-mono text-[10px] space-y-2 overflow-x-auto border-2 border-blue-500/30">
                          <p className="text-blue-400 font-bold mb-2 uppercase tracking-widest text-[9px]">Ação Necessária no Supabase Dashboard:</p>
                          <p>1. Vá em <span className="text-white">SQL Editor</span></p>
                          <p>2. Cole e execute o código abaixo:</p>
                          <div className="bg-black/50 p-3 rounded-lg text-emerald-400 select-all border border-slate-700 mt-3">
                            <pre>
{`-- 1. Criar a tabela se não existir
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  admin_category TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas para evitar duplicidade
DROP POLICY IF EXISTS "Perfis visíveis para todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem criar próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem editar próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins master podem deletar" ON public.profiles;

-- 4. Criar novas políticas robustas
CREATE POLICY "Leitura pública para autenticados" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inserção pelo próprio usuário" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Edição pelo próprio usuário ou Master" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR 
    (auth.jwt() ->> 'email' = 'adminnovo@gmail.com')
  );

CREATE POLICY "Deleção por Master" ON public.profiles
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'adminnovo@gmail.com'
  );

-- 5. SCRIPT PARA APAGAR TODOS USUÁRIOS EXCETO MASTER
-- Execute isto no SQL Editor para limpar usuários:
-- DELETE FROM auth.users WHERE email != 'adminnovo@gmail.com';
-- (A tabela public.profiles será limpa automaticamente)`}
                            </pre>
                          </div>
                          <button 
                            onClick={fetchProfiles}
                            className="mt-4 w-full py-2 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-blue-700 transition-colors"
                          >
                            Já executei o código, tentar novamente
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-4 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                            <th className="py-4 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                            <th className="py-4 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</th>
                            <th className="py-4 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Nível</th>
                            <th className="py-4 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {profilesLoading ? (
                            <tr>
                              <td colSpan={5} className="py-10 text-center">
                                <div className="flex items-center justify-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Carregando Equipe...
                                </div>
                              </td>
                            </tr>
                          ) : profiles.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">Nenhum usuário listado.</td>
                            </tr>
                          ) : (
                            profiles.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-4 px-2">
                                  <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                    {p.id.slice(0, 8).toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-4 px-2">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 text-sm">{p.display_name}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-2">
                                  <span className="text-xs text-slate-500 font-medium">{p.email}</span>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${
                                    p.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {p.role === 'admin' ? `Admin ${p.admin_category || ''}` : 'Visitador'}
                                  </span>
                                </td>
                                <td className="py-4 px-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => handleEditProfile(p)}
                                      className="p-2 text-blue-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                      title="Editar informações"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteUser(p.id!)}
                                      className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                      title="Remover usuário da lista"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                    key="list"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                      <div>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-1 tracking-tighter">Relatórios & Gestão</h2>
                        <p className="text-slate-500 text-sm font-medium tracking-tight">Total de {visitors.length} registros.</p>
                      </div>
                    </div>

                    {/* Advanced Report Config Card */}
                    <div className="card-native p-6 sm:p-8 bg-white border-2 border-blue-100 shadow-xl shadow-blue-900/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                        <FileText className="w-32 h-32 text-blue-900" />
                      </div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-200">
                            <FileText className="w-6 h-6" />
                          </div>
                          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Configurar Exportação</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                          {/* Period Filter */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Período de Cadastro</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { id: 'all', label: 'Tudo' },
                                { id: 'weekly', label: 'Semanal' },
                                { id: 'monthly', label: 'Mensal' }
                              ].map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => setReportPeriod(p.id as any)}
                                  className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 ${reportPeriod === p.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'}`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Category Filter */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              <Users className="w-3.5 h-3.5" />
                              <span>Filtrar por Grupo</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {isUserAdmin && user?.email !== 'adminnovo@gmail.com' ? (
                                <div className="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-blue-600 text-white border-2 border-blue-600 shadow-lg shadow-blue-200">
                                  {effectiveAdminCategory}
                                </div>
                              ) : (
                                (['homens', 'mulheres', 'jovens', 'todas'] as const).map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => setReportCategory(c)}
                                    className={`px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${reportCategory === c ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'}`}
                                  >
                                    {c}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100 flex flex-wrap gap-4">
                          <button 
                            disabled={visitors.length === 0}
                            onClick={() => handleGenerateReport('pdf')}
                            className="flex-1 sm:flex-none bg-blue-600 text-white hover:bg-blue-700 px-8 h-14 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-40"
                          >
                            <Download className="w-5 h-5" />
                            Gerar PDF
                          </button>
                          <button 
                            disabled={visitors.length === 0}
                            onClick={() => handleGenerateReport('csv')}
                            className="flex-1 sm:flex-none bg-emerald-600 text-white hover:bg-emerald-700 px-8 h-14 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-40"
                          >
                            <FileText className="w-5 h-5" />
                            Exportar CSV
                          </button>
                        </div>
                      </div>
                    </div>


                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>
      </main>

        {/* Mobile Navbar */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-100 h-14 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          <button 
            onClick={() => setView('home')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${view === 'home' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <ShieldCheck className={`w-6 h-6 ${view === 'home' ? 'scale-110 drop-shadow-sm' : 'scale-100'}`} />
            <span className="text-[9px] font-black uppercase tracking-tighter">Início</span>
          </button>
          
          <button 
            onClick={() => setView('register')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${view === 'register' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <UserPlus className={`w-6 h-6 ${view === 'register' ? 'scale-110 drop-shadow-sm' : 'scale-100'}`} />
            <span className="text-[9px] font-black uppercase tracking-tighter">Novo</span>
          </button>
          
          {isUserAdmin && (
            <button 
              onClick={() => {
                setView('list');
                setReportCategory(effectiveAdminCategory as any);
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${view === 'list' ? 'text-blue-600' : 'text-slate-400'}`}
            >
              <FileText className={`w-6 h-6 ${view === 'list' ? 'scale-110 drop-shadow-sm' : 'scale-100'}`} />
              <span className="text-[9px] font-black uppercase tracking-tighter">Relatórios</span>
            </button>
          )}

          {isUserAdmin && (
            <button 
              onClick={() => setView('users')}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${view === 'users' ? 'text-blue-600' : 'text-slate-400'}`}
            >
              <Users className={`w-6 h-6 ${view === 'users' ? 'scale-110 drop-shadow-sm' : 'scale-100'}`} />
              <span className="text-[9px] font-black uppercase tracking-tighter">Usuários</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
