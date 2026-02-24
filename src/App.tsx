
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { PosView } from '@/features/pos/PosView';
import { InventoryView } from '@/features/inventory/InventoryView';
import { SettingsView } from '@/features/settings/SettingsView';

// Placeholders for now
const ReportsView = () => <div className="p-4">Reports</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<PosView />} />
          <Route path="inventory" element={<InventoryView />} />
          <Route path="reports" element={<ReportsView />} />
          <Route path="settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
