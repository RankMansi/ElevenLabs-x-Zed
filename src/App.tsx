import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Play from './pages/Play';

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play/:runId" element={<Play />} />
    </Routes>
  </BrowserRouter>
);

export default App;
