import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import Orders from './pages/Orders';
import Leads from './pages/Leads';
import Automation from './pages/Automation';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/automation" element={<Automation />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;