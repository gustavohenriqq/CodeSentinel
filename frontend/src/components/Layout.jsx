import { Navbar } from './Navbar.jsx';

export function Layout({ children }) {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content fade-in">
        {children}
      </main>
    </div>
  );
}
