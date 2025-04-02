import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import MapPage from './pages/MapPage';
import SourcesPage from './pages/SourcesPage';
import EventsPage from './pages/EventsPage';
import LogsPage from './pages/LogsPage';
import HuntingtonPage from './pages/HuntingtonPage';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<MapPage />} />
          <Route path="sources" element={<SourcesPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="huntington" element={<HuntingtonPage />} />
        </Route>
      </Routes>
      <ToastContainer position="bottom-right" />
    </>
  );
}

export default App;
