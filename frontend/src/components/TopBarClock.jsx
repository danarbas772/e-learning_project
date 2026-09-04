import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import './TopBarClock.css';

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function TopBarClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dayName = DAYS_ID[now.getDay()];
  const dateNum = now.getDate();
  const monthName = MONTHS_ID[now.getMonth()];
  const yearNum = now.getFullYear();

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return (
    <div className="topbar-clock-container animate-fadeIn">
      <div className="topbar-clock-pill">
        <div className="topbar-clock-item">
          <Calendar size={14} className="topbar-clock-icon calendar-icon" />
          <span className="topbar-clock-date">
            <strong>{dayName}</strong>, {dateNum} {monthName} {yearNum}
          </span>
        </div>

        <div className="topbar-clock-divider" />

        <div className="topbar-clock-item">
          <span className="clock-pulse-dot" />
          <Clock size={14} className="topbar-clock-icon clock-icon" />
          <span className="topbar-clock-time">
            {hours}:{minutes}:{seconds} <span className="topbar-clock-tz">WIB</span>
          </span>
        </div>
      </div>
    </div>
  );
}
