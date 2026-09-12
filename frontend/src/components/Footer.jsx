import './Footer.css';

export default function Footer({ className = '' }) {
  return (
    <footer className={`app-footer ${className}`}>
      <p className="app-footer-text">
        &copy; 2025 Bas Learning. All rights reserved.
      </p>
    </footer>
  );
}
