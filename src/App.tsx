import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import Booking from './pages/Booking';
import Tracking from './pages/Tracking';
import AdminDashboard from './pages/admin/Dashboard';
import Login from './pages/admin/Login';
import Sales from './pages/admin/Sales';
import MapConfig from './pages/admin/MapConfig';
import QRScanner from './pages/admin/QRScanner';
import EventDatesConfig from './pages/admin/EventDatesConfig';
import Vendedores from './pages/admin/Vendedores';
import Gastos from './pages/admin/Gastos';
import ReporteCaja from './pages/admin/ReporteCaja';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Rutas Públicas / Cliente */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="booking" element={<Booking />} />
          <Route path="tracking" element={<Tracking />} />
        </Route>

        {/* Rutas Admin protegidas */}
        <Route element={<PrivateRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="fechas" element={<EventDatesConfig />} />
            <Route path="ventas" element={<Sales />} />
            <Route path="mapa" element={<MapConfig />} />
            <Route path="scanner" element={<QRScanner />} />
            <Route path="vendedores" element={<Vendedores />} />
            <Route path="gastos" element={<Gastos />} />
            <Route path="caja" element={<ReporteCaja />} />
          </Route>
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
