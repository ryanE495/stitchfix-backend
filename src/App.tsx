import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';
import { KanbanPage } from './pages/KanbanPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { NumbersPage } from './pages/NumbersPage';
import { RepairRequestsPage } from './pages/RepairRequestsPage';
import { PortfolioListPage } from './pages/PortfolioListPage';

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<KanbanPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/repairs" element={<RepairRequestsPage />} />
            <Route path="/numbers" element={<NumbersPage />} />
            <Route path="/portfolio" element={<PortfolioListPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthGate>
  );
}
