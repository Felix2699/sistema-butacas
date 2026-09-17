import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Map, QrCode, LogOut, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/fechas', label: 'Fechas de Evento', icon: Calendar, end: false },
  { to: '/admin/ventas', label: 'Ventas / Pagos', icon: Users, end: false },
  { to: '/admin/mapa', label: 'Configurar Zonas', icon: Map, end: false },
  { to: '/admin/scanner', label: 'Lector QR', icon: QrCode, end: false },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <h2 className="text-2xl font-black text-primary-dark tracking-tight">Admin<span className="text-primary">Panel</span></h2>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition text-sm',
                isActive
                  ? 'bg-primary/10 text-primary-dark'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg font-medium transition w-full text-sm"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
