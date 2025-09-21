import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">Lead Operation System</div>
        <nav className="nav">
          <Link to="/" className={isActive('/') ? 'active' : ''}>
            Dashboard
          </Link>
          <Link to="/orders" className={isActive('/orders') ? 'active' : ''}>
            Orders
          </Link>
          <Link to="/leads" className={isActive('/leads') ? 'active' : ''}>
            Leads
          </Link>
          <Link to="/automation" className={isActive('/automation') ? 'active' : ''}>
            Automation
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
