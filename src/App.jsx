import React, { useState, useEffect, useMemo, useCallback } from 'react';
// ✅ 正式環境：直接使用標準 import
import { createClient } from '@supabase/supabase-js'; 
import { 
  ShoppingCart, Package, Users, BarChart, LogOut, Plus, Trash2, Edit, 
  Menu, X, Image as ImageIcon, Database, AlertCircle, CheckCircle, 
  ShieldCheck, Camera, Loader2, Search, FileText, UserPlus, History,
  ChevronLeft, ChevronRight, MessageCircle, Download,
  CheckSquare, TrendingUp, DollarSign, Settings,
  ShoppingBag, Key, UserCog, AlertTriangle, MapPin, Bell
} from 'lucide-react';

/**
 * ==============================================================================
 * ⚙️ 系統設定 (已填入您的真實 Supabase 金鑰)
 * ==============================================================================
 */
const SUPABASE_URL = "https://lzbydwwogzooavvjjajp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Ynlkd3dvZ3pvb2F2dmpqYWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NzE0MzAsImV4cCI6MjA4MjA0NzQzMH0.xIV-eUf-sOaPpRTreK2ccT38Auy9qCVpyWAgDqgO2h8";

// ✅ 建立單一 Supabase 實例
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_SECRET = "admin123";
const ITEMS_PER_PAGE = 12;
const THEME_COLORS = ['#4F46E5', '#000000', '#DC2626', '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777', '#9333EA', '#0891B2', '#EA580C', '#475569'];

/**
 * 🛠️ UTILITIES
 */
const urlCache = new Map();

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/image.*/)) return reject(new Error('僅支援圖片檔案'));
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
      };
    };
    reader.onerror = () => reject(new Error('讀取失敗'));
  });
};

const formatDate = (isoString) => {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString('zh-HK', { hour12: false });
};

const getWeekString = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const exportToCSV = (orders, period) => {
  const headers = ["訂單ID", "日期", "會員電話", "收貨地址", "狀態", "總金額", "商品內容", "備註"];
  const rows = orders.map(o => [
    o.id,
    formatDate(o.created_at),
    o.user_phone,
    o.delivery_address || '未填寫',
    o.status_code === 'confirmed' ? '已完成' : (o.status_code === 'cancelled' ? '已取消' : '待確認'),
    o.total,
    o.items.map(i => `${i.title} ${i.variant ? `[${i.variant}]` : ''} x${i.qty}`).join('; '),
    (o.admin_notes || []).map(n => n.text).join(' | ')
  ]);
  const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `VIP_Orders_${period}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
};

/**
 * 🧱 COMPONENTS
 */
const ProductGallery = ({ paths, className }) => {
  const [urls, setUrls] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadImages = async () => {
      if (!paths || paths.length === 0) { if(isMounted) setUrls([]); return; }
      const loadedUrls = await Promise.all(paths.map(async (path) => {
        if (urlCache.has(path)) return urlCache.get(path);
        const { data } = await supabase.storage.from('products').createSignedUrl(path, 3600);
        if (data?.signedUrl) {
          urlCache.set(path, data.signedUrl);
          return data.signedUrl;
        }
        return null;
      }));
      if (isMounted) setUrls(loadedUrls.filter(Boolean));
    };
    loadImages();
    return () => { isMounted = false; };
  }, [paths]);

  if (urls.length === 0) return <div className={`bg-gray-100 flex items-center justify-center ${className}`}><ImageIcon className="text-gray-300"/></div>;

  return (
    <div className={`relative group ${className} bg-white`}>
      <img src={urls[idx]} className="w-full h-full object-contain transition-all duration-300" loading="lazy" />
      {urls.length > 1 && (
        <>
          <button onClick={(e) => {e.stopPropagation(); setIdx((i) => (i - 1 + urls.length) % urls.length)}} className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/30 text-white p-1 rounded-full opacity-0 group-hover:opacity-100"><ChevronLeft size={16}/></button>
          <button onClick={(e) => {e.stopPropagation(); setIdx((i) => (i + 1) % urls.length)}} className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/30 text-white p-1 rounded-full opacity-0 group-hover:opacity-100"><ChevronRight size={16}/></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {urls.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-gray-800' : 'bg-gray-300'}`} />)}
          </div>
        </>
      )}
    </div>
  );
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
    <div className="bg-white w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-scale-in">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
        <h3 className="font-bold text-lg text-gray-800">{title}</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">{children}</div>
    </div>
  </div>
);

const ConfirmModal = ({ title, message, onConfirm, onCancel, confirmText = "確認執行", confirmColor = "bg-red-600" }) => (
  <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-scale-in text-center">
      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={24} />
      </div>
      <h3 className="font-bold text-lg text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition">取消</button>
        <button onClick={onConfirm} className={`flex-1 py-2.5 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition ${confirmColor}`}>
          {confirmText}
        </button>
      </div>
    </div>
  </div>
);

const AnnouncementModal = ({ title, content, onClose }) => (
  <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center">
        <Bell size={48} className="mx-auto mb-3 opacity-90 animate-bounce" />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="p-6">
        <p className="text-gray-700 whitespace-pre-wrap text-center leading-relaxed text-sm">{content}</p>
        <button onClick={onClose} className="w-full mt-6 bg-gray-900 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
          我知道了
        </button>
      </div>
    </div>
  </div>
);

const FloatingCart = ({ count, onClick, color }) => {
  if (count === 0) return null;
  return (
    <button onClick={onClick} className="fixed bottom-20 right-6 z-40 text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 flex items-center gap-2 animate-bounce-in transition-all md:bottom-6" style={{backgroundColor: color}}>
      <ShoppingCart size={24} />
      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">{count}</span>
    </button>
  );
};

// Supabase Hook
const useSupabase = () => {
  const [client, setClient] = useState(null);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    setClient(supabase);
    setIsReady(true);
  }, []);
  return { client, isReady };
};

/**
 * 📱 MAIN APP
 */
export default function App() {
  const { client: supabase, isReady } = useSupabase();
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [cart, setCart] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState({ 
    store_name: 'VIP Store', theme_color: '#4F46E5', announcement: '', 
    background_image: '', whatsapp_number: '85212345678',
    popup_enabled: false, popup_title: '', popup_content: ''
  });
  const [showPopup, setShowPopup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Init
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user_profile');
      if (savedUser) { setCurrentUser(JSON.parse(savedUser)); setView('shop'); } else { setView('login'); }
      const savedCart = localStorage.getItem('cart');
      if (savedCart) setCart(JSON.parse(savedCart));
      
      if(supabase) {
        supabase.from('site_settings').select('*').single().then(({data}) => { 
          if(data) {
            setSettings(data);
            const hasSeen = sessionStorage.getItem('hasSeenPopup');
            if (data.popup_enabled && !hasSeen && savedUser) {
               const user = JSON.parse(savedUser);
               if (user.role !== 'admin') setTimeout(() => setShowPopup(true), 1500);
            }
          }
        });
      }
    } catch(e) { setView('login'); }
  }, []);

  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);
  
  const closePopup = () => { setShowPopup(false); sessionStorage.setItem('hasSeenPopup', 'true'); };
  const notify = (msg, type = 'success') => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };
  const handleLogin = (user) => { setCurrentUser(user); localStorage.setItem('user_profile', JSON.stringify(user)); setView('shop'); notify(`歡迎回來，${user.phone}`); };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('user_profile'); setCart([]); setView('login'); notify('已安全登出'); };
  
  const addToCart = (product, variant = null) => {
    const finalPrice = variant ? Number(variant.price) : Number(product.price);
    const cartItemId = variant ? `${product.id}-${variant.name}` : `${product.id}`;
    const title = variant ? `${product.title} [${variant.name}]` : product.title;

    setCart(prev => {
      const exists = prev.find(p => p.cartId === cartItemId);
      if (exists) return prev.map(p => p.cartId === cartItemId ? { ...p, qty: p.qty + 1 } : p);
      return [...prev, { ...product, id: product.id, cartId: cartItemId, title, price: finalPrice, variant: variant?.name, qty: 1 }];
    });
    notify('已加入購物車');
  };

  const updateQty = (cartId, delta) => {
    setCart(prev => prev.map(p => p.cartId === cartId ? { ...p, qty: Math.max(0, p.qty + delta) } : p).filter(p => p.qty > 0));
  };

  const clearCart = () => { if(confirm('確定清空購物車？')) { setCart([]); notify('購物車已清空'); } };

  if (view === 'loading') return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;

  if (!currentUser || view === 'login') {
    return <AuthScreen supabase={supabase} settings={settings} onLogin={handleLogin} notify={notify} />;
  }

  const isAdmin = currentUser?.role === 'admin';
  const cartCount = cart.reduce((a, b) => a + b.qty, 0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:pb-0" style={{'--theme-color': settings.theme_color}}>
      {showPopup && <AnnouncementModal title={settings.popup_title} content={settings.popup_content} onClose={closePopup} />}
      {showProfile && <UserProfileModal supabase={supabase} user={currentUser} onClose={() => setShowProfile(false)} notify={notify} onLogout={handleLogout} />}

      <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{backgroundColor: settings.theme_color}}><ShieldCheck size={20} className="text-white" /></div>
              <span className="text-xl font-bold tracking-tight text-gray-900 hidden sm:block">{settings.store_name}</span>
              <span className="text-xl font-bold tracking-tight text-gray-900 sm:hidden">VIP Store</span>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <NavBtn active={view === 'shop'} onClick={() => setView('shop')} icon={<ShoppingBag size={18}/>} label="商店" />
              {isAdmin && <NavBtn active={view.startsWith('admin')} onClick={() => setView('admin_products')} icon={<Database size={18}/>} label="後台" />}
              <div className="ml-4 pl-4 border-l border-gray-200 flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(true)}>
                <span className="text-xs font-bold text-gray-600 hover:text-indigo-600 transition">{currentUser.phone}</span>
                <UserCog size={18} className="text-gray-400 hover:text-indigo-600"/>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 ml-2" title="登出"><LogOut size={18}/></button>
            </div>
            <div className="flex items-center gap-4 md:hidden">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
            </div>
          </div>
        </div>
        
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 absolute w-full z-50 shadow-xl p-4 space-y-2 animate-fade-in-down">
             <div className="bg-gray-50 p-3 rounded-lg mb-2 flex justify-between items-center" onClick={() => {setShowProfile(true); setIsMobileMenuOpen(false);}}>
                <div><p className="text-xs text-gray-500">帳號</p><p className="font-bold">{currentUser.phone}</p></div><Settings size={18} className="text-gray-400"/>
             </div>
             <button onClick={() => {setView('shop'); setIsMobileMenuOpen(false)}} className="w-full text-left py-2 font-medium">商店首頁</button>
             {isAdmin && <><button onClick={() => {setView('admin_products'); setIsMobileMenuOpen(false)}} className="w-full text-left py-2">商品管理</button><button onClick={() => {setView('admin_members'); setIsMobileMenuOpen(false)}} className="w-full text-left py-2">會員管理</button><button onClick={() => {setView('admin_reports'); setIsMobileMenuOpen(false)}} className="w-full text-left py-2">銷售報表</button><button onClick={() => {setView('admin_settings'); setIsMobileMenuOpen(false)}} className="w-full text-left py-2">商店設定</button></>}
             <button onClick={handleLogout} className="w-full text-left py-3 text-red-600 font-bold border-t mt-2">登出系統</button>
          </div>
        )}
      </nav>

      {settings.announcement && view === 'shop' && (
        <div className="bg-indigo-50 text-indigo-800 text-xs py-2 px-4 text-center font-medium">📢 {settings.announcement}</div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {notification && (
          <div className={`fixed top-20 right-4 z-[100] px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-bounce ${notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`}>
             {notification.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>}
             <span className="font-medium text-sm">{notification.msg}</span>
          </div>
        )}

        {view === 'shop' && <ShopView supabase={supabase} addToCart={addToCart} isAdmin={isAdmin} themeColor={settings.theme_color} />}
        {view === 'cart' && <CartView cart={cart} updateQty={updateQty} clearCart={clearCart} total={cart.reduce((a, b) => a + b.price * b.qty, 0)} user={currentUser} supabase={supabase} notify={notify} themeColor={settings.theme_color} whatsapp={settings.whatsapp_number} />}
        
        {isAdmin && (
          <>
            {view === 'admin_products' && <AdminProducts supabase={supabase} notify={notify} />}
            {view === 'admin_members' && <AdminMembers supabase={supabase} notify={notify} currentUser={currentUser} />}
            {view === 'admin_reports' && <AdminReports supabase={supabase} notify={notify} />}
            {view === 'admin_settings' && <AdminSettings supabase={supabase} notify={notify} settings={settings} onUpdate={setSettings} />}
          </>
        )}
      </main>

      {!isAdmin && view === 'shop' && <FloatingCart count={cartCount} onClick={() => setView('cart')} color={settings.theme_color} />}

      {isAdmin && view.startsWith('admin') && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-gray-200 rounded-full px-2 py-1 gap-1 z-40 flex animate-fade-in-up">
           <TabBtn active={view === 'admin_products'} onClick={() => setView('admin_products')} label="商品" icon={<Package size={16}/>} />
           <TabBtn active={view === 'admin_members'} onClick={() => setView('admin_members')} label="會員" icon={<Users size={16}/>} />
           <TabBtn active={view === 'admin_reports'} onClick={() => setView('admin_reports')} label="報表" icon={<BarChart size={16}/>} />
           <TabBtn active={view === 'admin_settings'} onClick={() => setView('admin_settings')} label="設定" icon={<Settings size={16}/>} />
        </div>
      )}
    </div>
  );
}

/**
 * 🔐 AUTH SCREEN
 */
function AuthScreen({ supabase, settings, onLogin, notify }) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ phone: '', password: '', confirm: '', secret: '' });
  const [loading, setLoading] = useState(false);
  const [bgUrl, setBgUrl] = useState(null);

  useEffect(() => {
    if (settings.background_image) {
      supabase.storage.from('products').createSignedUrl(settings.background_image, 3600).then(({data}) => { if(data?.signedUrl) setBgUrl(data.signedUrl); });
    }
  }, [settings.background_image]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.phone.length !== 8) return notify('電話需8碼', 'error');
    if (form.password.length < 6) return notify('密碼太短', 'error');
    if (isRegister && form.password !== form.confirm) return notify('密碼不一致', 'error');

    setLoading(true);
    try {
      const hashedPassword = await hashPassword(form.password);
      if (isRegister) {
        const { data: existing } = await supabase.from('profiles').select('*').eq('phone', form.phone).single();
        if (existing) throw new Error('已註冊');
        const role = form.secret === ADMIN_SECRET ? 'admin' : 'member';
        const { error } = await supabase.from('profiles').insert([{ ...form, name: `User ${form.phone}`, password: hashedPassword, role, is_approved: role==='admin', status: 'active', created_at: new Date().toISOString() }]);
        if (error) throw error;
        if (role === 'admin') onLogin({ phone: form.phone, role }); else { notify('註冊成功，等待審核', 'success'); setIsRegister(false); }
      } else {
        const { data: user, error } = await supabase.from('profiles').select('*').eq('phone', form.phone).single();
        if (error || !user) throw new Error('帳號不存在');
        if (user.password !== hashedPassword) throw new Error('密碼錯誤');
        if (user.status === 'blocked') throw new Error(`被封鎖: ${user.block_reason || '違反規定'}`);
        if (!user.is_approved) throw new Error('審核中');
        onLogin(user);
      }
    } catch (err) { notify(err.message, 'error'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center transition-all duration-1000" style={{backgroundImage: bgUrl ? `url(${bgUrl})` : 'none', backgroundColor: bgUrl ? 'transparent' : '#f3f4f6'}}>
      {bgUrl && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>}
      <div className="bg-white/95 backdrop-blur-md w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-scale-in">
        <div className="p-8 text-center" style={{backgroundColor: settings.theme_color || '#4F46E5'}}><ShieldCheck size={40} className="text-white mx-auto mb-2 opacity-90"/><h1 className="text-2xl font-bold text-white">{settings.store_name}</h1></div>
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <input className="w-full px-4 py-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none text-base" placeholder="電話 (+852)" value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,'')})} />
          <input type="password" className="w-full px-4 py-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none text-base" placeholder="密碼" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          {isRegister && <input type="password" className="w-full px-4 py-3 bg-gray-50 border rounded-lg border-l-4 border-l-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-base" placeholder="確認密碼" value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} />}
          {isRegister && <input className="w-full px-4 py-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none text-base" placeholder="管理密鑰 (選填)" value={form.secret} onChange={e => setForm({...form, secret: e.target.value})} />}
          <button disabled={loading} className="w-full py-3 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-transform active:scale-95 text-base flex items-center justify-center gap-2" style={{backgroundColor: settings.theme_color || '#4F46E5'}}>
            {loading ? <Loader2 className="animate-spin" size={20}/> : (isRegister ? '註冊' : '登入')}
          </button>
          <p className="text-center text-sm text-gray-500 mt-4 cursor-pointer hover:text-indigo-600 font-medium" onClick={() => setIsRegister(!isRegister)}>{isRegister ? '返回登入' : '註冊帳號'}</p>
        </form>
      </div>
    </div>
  );
}

function UserProfileModal({ supabase, user, onClose, notify, onLogout }) {
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const handleChangePassword = async (e) => {
    e.preventDefault(); if (form.newPassword.length < 6 || form.newPassword !== form.confirmPassword) return notify('密碼無效', 'error');
    setLoading(true); try { const oldHash = await hashPassword(form.oldPassword); const { data } = await supabase.from('profiles').select('password').eq('phone', user.phone).single(); if (data.password !== oldHash) throw new Error('舊密碼錯'); const newHash = await hashPassword(form.newPassword); await supabase.from('profiles').update({ password: newHash }).eq('phone', user.phone); notify('成功,請登入'); onLogout(); } catch (err) { notify(err.message, 'error'); } finally { setLoading(false); }
  };
  return (
    <Modal title="個人中心" onClose={onClose}>
      <div className="space-y-6"><div className="bg-gray-50 p-4 rounded-xl flex items-center gap-4"><div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xl">{user.phone.slice(-2)}</div><div><h4 className="font-bold text-gray-800">會員 {user.phone}</h4><p className="text-xs text-gray-500">{user.role}</p></div></div><div className="border-t pt-4"><h4 className="font-bold text-sm text-gray-700 mb-3">修改密碼</h4><form onSubmit={handleChangePassword} className="space-y-3"><input type="password" placeholder="舊密碼" className="w-full border p-2 rounded" value={form.oldPassword} onChange={e => setForm({...form, oldPassword: e.target.value})} /><input type="password" placeholder="新密碼" className="w-full border p-2 rounded" value={form.newPassword} onChange={e => setForm({...form, newPassword: e.target.value})} /><input type="password" placeholder="確認" className="w-full border p-2 rounded" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} /><button disabled={loading} className="w-full bg-gray-900 text-white py-2 rounded">{loading ? '...' : '確認'}</button></form></div></div>
    </Modal>
  );
}

function ShopView({ supabase, addToCart, isAdmin, themeColor }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('全部');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setLoading(true);
    const from = isRefresh ? 0 : page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    let query = supabase.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    if (!isAdmin) query = query.eq('is_visible', true);
    const { data, error } = await query;
    if (error) { setLoading(false); return; }
    const formatted = data.map(p => ({ ...p, images: p.images || (p.image_path ? [p.image_path] : []), variants: p.variants || [] }));
    if (isRefresh) { setProducts(formatted); setPage(1); } else { setProducts(p => { const ids = new Set(p.map(i=>i.id)); return [...p, ...formatted.filter(i=>!ids.has(i.id))]; }); setPage(p=>p+1); }
    setHasMore(data.length === ITEMS_PER_PAGE); setLoading(false);
  }, [isAdmin, page]);
  useEffect(() => { fetchProducts(true); }, [isAdmin]);
  const categories = ['全部', ...new Set(products.map(p=>p.category).filter(Boolean))];
  const display = products.filter(p => category==='全部'||p.category===category);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{categories.map(cat => (<button key={cat} onClick={()=>setCategory(cat)} className={`px-4 py-1.5 rounded-full text-sm font-bold border ${category===cat?'text-white border-transparent':'bg-white text-gray-600'}`} style={category===cat?{backgroundColor:themeColor}:{}}>{cat}</button>))}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{display.map(p => (
        <div key={p.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col"><div className="aspect-[4/3] bg-gray-50 relative"><ProductGallery paths={p.images} className="w-full h-full" />{!p.is_visible && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">已下架</div>}</div><div className="p-4 flex-1 flex flex-col"><h3 className="font-bold mb-1">{p.title}</h3><p className="text-xs text-gray-500 mb-4 line-clamp-2">{p.description}</p><div className="flex justify-between items-center mt-auto"><div><span className="text-lg font-bold" style={{color:themeColor}}>${p.price}</span>{p.variants?.length>0&&<span className="text-xs text-gray-400 block">多規格</span>}</div><button onClick={() => p.variants?.length > 0 ? setSelectedProduct(p) : addToCart(p)} className="text-white p-2 rounded-xl" style={{backgroundColor:'#1f2937'}}>{p.variants?.length>0?<Settings size={20}/>:<Plus size={20}/>}</button></div></div></div>
      ))}</div>
      {hasMore && <div className="text-center pt-4"><button onClick={()=>fetchProducts(false)} className="px-6 py-2 bg-gray-100 rounded-full text-sm font-bold">載入更多</button></div>}
      {selectedProduct && <Modal title={`選擇 ${selectedProduct.title}`} onClose={()=>setSelectedProduct(null)}><div className="space-y-2">{selectedProduct.variants.map((v, i) => (<button key={i} onClick={()=>{addToCart(selectedProduct, v); setSelectedProduct(null)}} className="w-full flex justify-between p-3 border rounded-lg hover:bg-gray-50"><span className="font-bold">{v.name}</span><span className="text-emerald-600 font-bold">${v.price}</span></button>))}</div></Modal>}
    </div>
  );
}

function CartView({ cart, updateQty, clearCart, total, user, notify, whatsapp }) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { const s = localStorage.getItem('user_address'); if(s) setAddress(s); }, []);
  const checkout = async () => {
    if(!address.trim()) return notify('請填寫地址', 'error');
    setLoading(true); localStorage.setItem('user_address', address);
    const { data, error } = await supabase.from('orders').insert([{ user_phone: user.phone, user_name: '會員', items: cart, total, status_code: 'pending', created_at: new Date().toISOString(), delivery_address: address }]).select();
    setLoading(false); if(error) return notify('失敗', 'error');
    let msg = `*訂單 #${data[0].id}*\n電話: ${user.phone}\n地址: ${address}\n----------------\n`;
    cart.forEach(i => msg += `${i.title} ${i.variant?`[${i.variant}]`:''} x${i.qty} ($${i.price*i.qty})\n`);
    msg += `----------------\n*總額: $${total}*`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank'); notify('已送出');
  };
  if(!cart.length) return <div className="text-center py-20 text-gray-400">空購物車</div>;
  return (
    <div className="max-w-xl mx-auto space-y-4 pb-20">
      <div className="flex justify-end"><button onClick={clearCart} className="text-red-500 text-sm flex items-center gap-1"><Trash2 size={14}/> 清空</button></div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">{cart.map(i => (<div key={i.cartId} className="p-4 flex gap-4 border-b last:border-0"><div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0"><ProductGallery paths={i.images} className="w-full h-full"/></div><div className="flex-1"><h4 className="font-bold">{i.title}</h4>{i.variant&&<span className="text-xs bg-gray-100 px-1 rounded">{i.variant}</span>}<div className="text-sm mt-1">${i.price}</div></div><div className="flex items-center bg-gray-50 rounded-lg"><button onClick={()=>updateQty(i.cartId, -1)} className="px-3 py-1">-</button><span className="px-2 text-sm">{i.qty}</span><button onClick={()=>updateQty(i.cartId, 1)} className="px-3 py-1">+</button></div></div>))}</div>
      <div className="bg-white p-4 rounded-xl shadow-sm border"><label className="text-sm font-bold block mb-2">收貨地址 (必填)</label><textarea className="w-full border rounded-lg p-3 text-sm" rows="3" value={address} onChange={e=>setAddress(e.target.value)} placeholder="請輸入..."></textarea></div>
      <div className="bg-white p-6 rounded-xl shadow-sm border"><div className="flex justify-between mb-4"><span className="text-gray-500">總額</span><span className="text-3xl font-bold text-emerald-600">${total}</span></div><button onClick={checkout} disabled={loading} className="w-full py-3 bg-[#25D366] text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">{loading?<Loader2 className="animate-spin"/>:<><MessageCircle/> 結帳</>}</button></div>
    </div>
  );
}

function AdminSettings({ notify, settings, onUpdate }) {
  const [form, setForm] = useState(settings);
  const [uploading, setUploading] = useState(false);
  const handleBgUpload = async (e) => { const file=e.target.files[0]; if(!file)return; setUploading(true); try{ const blob=await compressImage(file); const {data,error}=await supabase.storage.from('products').upload(`bg_${Date.now()}.jpg`,blob); if(error)throw error; setForm({...form,background_image:data.path}); notify('成功'); }catch(e){notify('失敗','error');} setUploading(false); };
  const handleSave = async () => { const {error}=await supabase.from('site_settings').update(form).eq('id',1); if(!error){notify('已儲存');onUpdate(form);}else notify('失敗','error'); };
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm"><h2 className="font-bold">設定</h2></div>
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
        <div><label className="text-sm font-bold">店名</label><input className="w-full border p-2 rounded" value={form.store_name} onChange={e=>setForm({...form,store_name:e.target.value})}/></div>
        <div><label className="text-sm font-bold">WhatsApp</label><input className="w-full border p-2 rounded" value={form.whatsapp_number} onChange={e=>setForm({...form,whatsapp_number:e.target.value})}/></div>
        <div><label className="text-sm font-bold">主題色</label><div className="grid grid-cols-6 gap-3 mt-2">{THEME_COLORS.map(c=><button key={c} onClick={()=>setForm({...form,theme_color:c})} className="w-8 h-8 rounded-full border-2" style={{backgroundColor:c, borderColor:form.theme_color===c?'black':'transparent'}}/>)}</div></div>
        <div className="bg-gray-50 p-3 rounded space-y-2"><div className="flex justify-between"><label className="font-bold">公告彈窗</label><input type="checkbox" checked={form.popup_enabled} onChange={e=>setForm({...form,popup_enabled:e.target.checked})}/></div>{form.popup_enabled&&<><input className="w-full border p-2 rounded" placeholder="標題" value={form.popup_title} onChange={e=>setForm({...form,popup_title:e.target.value})}/><textarea className="w-full border p-2 rounded h-20" placeholder="內容" value={form.popup_content} onChange={e=>setForm({...form,popup_content:e.target.value})}/></>}</div>
        <div><label className="text-sm font-bold">跑馬燈</label><textarea className="w-full border p-2 rounded h-16" value={form.announcement} onChange={e=>setForm({...form,announcement:e.target.value})}/></div>
        <div><label className="text-sm font-bold">背景圖</label><div className="mt-2 flex gap-4"><div className="w-20 h-32 bg-gray-100 rounded overflow-hidden"><ProductGallery paths={[form.background_image]} className="w-full h-full"/></div><label className="cursor-pointer bg-gray-100 px-4 py-2 rounded text-sm">{uploading?'...':'更換'}<input type="file" accept="image/*" className="hidden" onChange={handleBgUpload}/></label></div></div>
        <button onClick={handleSave} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold">儲存</button>
      </div>
    </div>
  );
}

function AdminProducts({ notify }) {
  const [products, setProducts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ title: '', price: '', category: '', description: '', is_visible: true, images: [], variants: [] });
  const [loading, setLoading] = useState(false);
  const [newVariant, setNewVariant] = useState({ name: '', price: '' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  useEffect(() => { const sub = supabase.channel('admin_prod').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { supabase.from('products').select('*').order('created_at', {ascending:false}).then(({data}) => setProducts(data.map(p=>({...p,images:p.images||(p.image_path?[p.image_path]:[]),variants:p.variants||[]})))) }).subscribe(); supabase.from('products').select('*').order('created_at', {ascending:false}).then(({data}) => setProducts(data.map(p=>({...p,images:p.images||(p.image_path?[p.image_path]:[]),variants:p.variants||[]})))) ; return () => supabase.removeChannel(sub); }, []);
  const handleCapture = async (e) => { const files=Array.from(e.target.files); if(!files.length)return; notify('上傳中...'); const paths=[]; try{ for(const f of files){ const b=await compressImage(f); const {data}=await supabase.storage.from('products').upload(`${Date.now()}_${Math.random()}.jpg`,b); paths.push(data.path); } setForm(p=>({...p,images:[...p.images,...paths]})); notify('完成'); } catch(err) { notify('失敗','error'); } };
  const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); const pl={...form,price:Number(form.price)}; const {error}=form.id?await supabase.from('products').update(pl).eq('id',form.id):await supabase.from('products').insert([pl]); setLoading(false); if(!error){notify('成功');setIsEditing(false);setForm({title:'',price:'',category:'',description:'',is_visible:true,images:[],variants:[]});}else notify('失敗','error'); };
  const handleDelete = async (id) => { if(confirm('刪除?')) await supabase.from('products').delete().eq('id', id); };
  const handleClear = async () => { setShowClearConfirm(false); notify('清除中...'); const { error } = await supabase.from('products').delete().neq('id',-1); if (!error) notify('已清除'); else notify('失敗', 'error'); };

  return (
    <div className="space-y-4">
       {showClearConfirm && <ConfirmModal title="⚠️ 危險" message="清空所有商品？" onConfirm={handleClear} onCancel={()=>setShowClearConfirm(false)} />}
       <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between"><h2 className="font-bold">商品管理</h2><div className="flex gap-2"><button onClick={()=>setShowClearConfirm(true)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-sm"><Trash2 size={16}/></button><button onClick={()=>{setForm({title:'',price:'',category:'',description:'',is_visible:true,images:[],variants:[]});setIsEditing(true)}} className="bg-gray-900 text-white px-3 py-1.5 rounded text-sm"><Plus size={16}/></button></div></div>
       {isEditing && <Modal title="編輯" onClose={()=>setIsEditing(false)}><form onSubmit={handleSubmit} className="space-y-4"><div className="grid grid-cols-4 gap-2">{form.images.map((p,i)=><div key={i} className="relative aspect-square border rounded overflow-hidden"><ProductGallery paths={[p]} className="w-full h-full"/><button type="button" onClick={()=>setForm(prev=>({...prev,images:prev.images.filter((_,idx)=>idx!==i)}))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5"><X size={12}/></button></div>)}<label className="aspect-square border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer"><Camera/><input type="file" multiple accept="image/*" className="hidden" onChange={handleCapture}/></label></div><input className="w-full border p-2 rounded" placeholder="名稱" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/><div className="grid grid-cols-2 gap-2"><input className="border p-2 rounded" type="number" placeholder="價格" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/><input className="border p-2 rounded" placeholder="分類" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} list="cats"/><datalist id="cats"><option value="生鮮"/><option value="雜貨"/><option value="電子"/></datalist></div><div className="bg-gray-50 p-2 rounded space-y-2"><div className="flex gap-2"><input className="flex-1 border p-1" placeholder="規格" value={newVariant.name} onChange={e=>setNewVariant({...newVariant,name:e.target.value})}/><input className="w-20 border p-1" placeholder="$" value={newVariant.price} onChange={e=>setNewVariant({...newVariant,price:e.target.value})}/><button type="button" onClick={()=>{if(newVariant.name&&newVariant.price)setForm(p=>({...p,variants:[...p.variants,{...newVariant}]}))}} className="bg-indigo-600 text-white px-2 rounded"><Plus size={16}/></button></div>{form.variants.map((v,i)=><div key={i} className="flex justify-between text-sm bg-white p-1 border"><span>{v.name} - ${v.price}</span><button type="button" onClick={()=>setForm(p=>({...p,variants:p.variants.filter((_,idx)=>idx!==i)}))} className="text-red-500"><X size={14}/></button></div>)}</div><textarea className="w-full border p-2 rounded h-20" placeholder="描述" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><label className="flex gap-2"><input type="checkbox" checked={form.is_visible} onChange={e=>setForm({...form,is_visible:e.target.checked})}/> 上架</label><button disabled={loading} className="w-full bg-emerald-600 text-white py-2 rounded font-bold">儲存</button></form></Modal>}
       <div className="grid gap-2">{products.map(p=><div key={p.id} className="bg-white p-3 rounded shadow-sm flex gap-3"><div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0"><ProductGallery paths={p.images} className="w-full h-full"/></div><div className="flex-1 overflow-hidden"><div className="font-bold truncate">{p.title}</div><div className="text-xs text-gray-500">${p.price}</div></div><button onClick={()=>{setForm(p);setIsEditing(true)}} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-indigo-600"><Edit size={14}/></button><button onClick={()=>handleDelete(p.id)} className="p-2 bg-red-50 text-red-500 rounded-full"><Trash2 size={14}/></button></div>)}</div>
    </div>
  );
}

function AdminMembers({ notify, currentUser }) {
  const [members, setMembers] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [note, setNote] = useState('');
  const [showClear, setShowClear] = useState(false);
  useEffect(() => { supabase.from('profiles').select('*').order('created_at',{ascending:false}).then(({data})=>setMembers(data||[])); }, []);
  const update = async (phone, data) => { if(phone===currentUser.phone) return; await supabase.from('profiles').update(data).eq('phone',phone); notify('更新成功'); setViewing(null); };
  const handleClear = async () => { setShowClear(false); notify('清除中...'); const {error}=await supabase.from('profiles').delete().neq('phone',currentUser.phone); if(!error) notify('已清除'); };

  return (
    <div className="space-y-4">
      {showClear && <ConfirmModal title="⚠️ 危險" message="清空所有會員？" onConfirm={handleClear} onCancel={()=>setShowClear(false)} />}
      <div className="bg-white p-4 rounded shadow-sm flex justify-between"><h2 className="font-bold">會員管理</h2><button onClick={()=>setShowClear(true)} className="text-red-500"><Trash2/></button></div>
      {viewing && <Modal title={`會員: ${viewing.phone}`} onClose={()=>setViewing(null)}><div className="space-y-4"><textarea className="w-full border p-2 rounded" placeholder="備註" value={note} onChange={e=>setNote(e.target.value)}/><button onClick={()=>update(viewing.phone,{admin_notes:note})} className="w-full bg-indigo-600 text-white py-2 rounded">儲存備註</button><div className="border-t pt-2"><h4 className="font-bold mb-2">歷史訂單</h4><UserOrdersHistory phone={viewing.phone}/></div></div></Modal>}
      {members.map(m => (
        <div key={m.phone} className="bg-white p-4 rounded shadow-sm flex justify-between items-center relative">
          <button onClick={()=>{setViewing(m);setNote(m.admin_notes||'')}} className="absolute inset-0 z-10 w-full h-full text-left"/>
          <div className="pointer-events-none z-0"><div className="font-bold">{m.phone} <span className="text-xs bg-gray-100 px-1 rounded">{m.is_approved?'Active':'Pending'}</span></div><div className="text-xs text-gray-500 mt-1">{m.admin_notes && `📝 ${m.admin_notes}`}</div></div>
          {m.role!=='admin' && <div className="relative z-20 flex gap-2"><button onClick={()=>update(m.phone,{is_approved:true})} className="px-2 py-1 bg-green-600 text-white text-xs rounded">批准</button><button onClick={()=>update(m.phone,{status:m.status==='blocked'?'active':'blocked'})} className="px-2 py-1 border text-xs rounded">{m.status==='blocked'?'解鎖':'封鎖'}</button></div>}
        </div>
      ))}
    </div>
  );
}

function UserOrdersHistory({ phone }) {
  const [orders, setOrders] = useState([]);
  useEffect(() => { supabase.from('orders').select('*').eq('user_phone', phone).order('created_at', {ascending: false}).then(({ data }) => setOrders(data||[])); }, [phone]);
  if (!orders.length) return <div className="text-center text-gray-400 py-4">無訂單記錄</div>;
  return <div className="space-y-2 max-h-60 overflow-y-auto">{orders.map(o => (<div key={o.id} className="border p-2 rounded text-sm flex justify-between"><span>{formatDate(o.created_at)}</span><span>${o.total}</span></div>))}</div>;
}

function AdminReports({ notify }) {
  const [orders, setOrders] = useState([]);
  const [viewType, setViewType] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [week, setWeek] = useState(getWeekString(new Date()));
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => { supabase.from('orders').select('*').order('created_at',{ascending:false}).then(({data})=>setOrders(data||[])); }, []);
  const filtered = orders.filter(o => {
    const d = o.created_at.slice(0,10);
    if(viewType==='daily') return d===date;
    if(viewType==='monthly') return d.slice(0,7)===date.slice(0,7);
    if(viewType==='weekly') return getWeekString(o.created_at)===getWeekString(date);
    return true;
  });
  const update = async (id, status) => { setLoadingId(id); if(status==='deleted') await supabase.from('orders').delete().eq('id',id); else await supabase.from('orders').update({status_code:status}).eq('id',id); setLoadingId(null); notify('更新成功'); };
  const sales = useMemo(() => { const s={}; filtered.filter(o=>o.status_code==='confirmed').forEach(o=>o.items.forEach(i=>{const k=i.title;s[k]=(s[k]||0)+i.qty})); return Object.entries(s).sort((a,b)=>b[1]-a[1]); }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded shadow-sm border-l-4 border-emerald-500"><div><div className="text-xs text-gray-500 font-bold">營收</div><div className="text-2xl font-bold">${filtered.filter(o=>o.status_code==='confirmed').reduce((s,o)=>s+(Number(o.total)||0),0).toLocaleString()}</div></div></div>
      <div className="bg-white p-3 rounded shadow-sm max-h-40 overflow-y-auto"><h4 className="text-xs font-bold mb-2">銷量排行</h4>{sales.map(([n,q])=><div key={n} className="flex justify-between text-xs py-1 border-b"><span>{n}</span><b>{q}</b></div>)}</div>
      <div className="flex gap-2">{['daily','weekly','monthly'].map(t=><button key={t} onClick={()=>setViewType(t)} className={`flex-1 py-1 text-xs rounded border ${viewType===t?'bg-black text-white':'bg-white'}`}>{t.toUpperCase()}</button>)}</div>
      {viewType==='daily'?<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full border p-2 rounded"/> : viewType==='monthly'?<input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="w-full border p-2 rounded"/>:<input type="week" value={week} onChange={e=>setWeek(e.target.value)} className="w-full border p-2 rounded"/>}
      <button onClick={() => exportToCSV(filtered, viewType)} className="w-full py-2 border rounded font-bold flex justify-center items-center gap-2"><Download size={14}/> 匯出報表</button>
      <div className="space-y-3">{filtered.map(o => (
        <div key={o.id} className="bg-white p-4 rounded shadow-sm border-l-4 border-gray-300">
           <div className="flex justify-between mb-2"><span>{o.user_phone}</span><span className="text-xs bg-gray-100 px-2 rounded">{o.status_code}</span></div>
           <div className="text-xs bg-gray-50 p-2 rounded mb-2">{o.items.map(i=><div key={i.title}>{i.title} x{i.qty}</div>)}</div>
           <div className="flex justify-end gap-2"><button onClick={()=>update(o.id,'confirmed')} disabled={loadingId===o.id} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded">{loadingId===o.id?'...':'確認'}</button><button onClick={()=>update(o.id,'cancelled')} disabled={loadingId===o.id} className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded">取消</button><button onClick={()=>update(o.id,'deleted')} className="text-xs text-gray-400 p-1.5"><Trash2 size={14}/></button></div>
        </div>
      ))}</div>
    </div>
  );
}

const NavBtn = ({ active, onClick, icon, label }) => (<button onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{icon} {label}</button>);
const MobileBtn = ({ onClick, icon, label }) => (<button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg text-gray-700 font-medium">{icon} {label}</button>);
const TabBtn = ({ active, onClick, label, icon }) => (<button onClick={onClick} className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${active ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}>{icon} {label}</button>);
const BottomNavBtn = ({ active, onClick, icon, label, badge }) => (<button onClick={onClick} className={`flex flex-col items-center gap-1 w-full p-1 relative ${active ? 'text-indigo-600' : 'text-gray-400'}`}>{icon}<span className="text-[10px] font-medium">{label}</span>{badge > 0 && <span className="absolute top-0 right-1/3 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">{badge}</span>}</button>);