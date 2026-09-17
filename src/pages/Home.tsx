import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-5xl font-black text-slate-900 tracking-tight">
          El Gran Evento de <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark">Estilistas 2026</span>
        </h1>
        <p className="text-xl text-slate-600 leading-relaxed">
          Reserva tu butaca hoy mismo y sé parte del mayor encuentro de profesionales de la belleza. Cupos limitados.
        </p>
        
        <div className="pt-8">
          <button 
            onClick={() => navigate('/booking')}
            className="px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/30 transition-all hover:-translate-y-1"
          >
            Comprar Entrada
          </button>
        </div>
      </div>
    </div>
  );
}
