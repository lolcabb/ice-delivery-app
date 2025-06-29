import React from 'react';
import { BrowserRouter , Routes, Route } from 'react-router-dom';
import MainLayout from './MainLayout';
import AdminPanel from './AdminPanel';

function App() {
  return (
    <BrowserRouter >
      <Routes>
       <Route path="/" element={<MainLayout />} />
       <Route path="/manage" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter >
  );
}

export default App;
