import { Outlet, Link } from 'react-router-dom';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-primary-dark">Evento Estilistas 2026</Link>
          <nav className="flex items-center gap-4">
            <Link to="/tracking" className="text-sm font-medium text-slate-500 hover:text-primary transition">Mi Reserva</Link>
            <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-primary transition">Acceso Admin</Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} Evento Estilistas. Todos los derechos reservados.
      </footer>
    </div>
  );
}
