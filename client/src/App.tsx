import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout/Layout';
import HomePage from './pages/HomePage';
import FileLibraryPage from './pages/FileLibraryPage';
import SearchPage from './pages/SearchPage';
import QAPage from './pages/QAPage';
import FactPage from './pages/FactPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import AgentPage from './pages/AgentPage';
import { setApiToken } from './api/index';

function App() {
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.apiToken) {
          setApiToken(data.apiToken);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch API token:', err);
      });
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="files" element={<FileLibraryPage />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="qa" element={<QAPage />} />
        <Route path="facts" element={<FactPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
