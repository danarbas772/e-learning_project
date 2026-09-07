import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopBarClock from '../components/TopBarClock';
import Footer from '../components/Footer';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, BookOpen, Award, Bell, Filter, CheckCircle2
} from 'lucide-react';
import './Calendar.css';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

// Default Academic & Lecture Events
const SAMPLE_EVENTS = [
  {
    id: 1,
    title: 'Pertemuan 1 - Pengenalan Kuliah & Kontrak',
    course: 'Pemrograman Berbasis Web',
    type: 'class', // class | exam | deadline | holiday
    date: '2026-09-04',
    time: '08:00 - 10:30 WIB',
    room: 'Lab Komputer 3 / Online',
  },
  {
    id: 2,
    title: 'Ujian Tengah Semester (UTS) Web Programming',
    course: 'Pemrograman Berbasis Web',
    type: 'exam',
    date: '2026-09-15',
    time: '09:00 - 11:00 WIB',
    room: 'Portal Ujian Online',
  },
  {
    id: 3,
    title: 'Batas Pengumpulan Tugas Desain Database',
    course: 'Basis Data Lanjut',
    type: 'deadline',
    date: '2026-09-18',
    time: '23:59 WIB',
    room: 'Sistem LMS',
  },
  {
    id: 4,
    title: 'Libur Maulid Nabi Muhammad SAW',
    course: 'Akademik Nasional',
    type: 'holiday',
    date: '2026-09-24',
    time: 'Sepanjang Hari',
    room: 'Hari Libur Nasional',
  },
  {
    id: 5,
    title: 'Sesi Praktikum React State & Hooks',
    course: 'Pemrograman Web Lanjut',
    type: 'class',
    date: '2026-09-11',
    time: '13:00 - 15:30 WIB',
    room: 'Lab Rekayasa Perangkat Lunak',
  },
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 4)); // Sept 2026
  const [selectedDateStr, setSelectedDateStr] = useState('2026-09-04');
  const [activeFilter, setActiveFilter] = useState('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Hari pertama bulan ini (0 = Minggu, 1 = Senin, dst)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Sesuaikan ke Senin sebagai index 0
  const adjustedFirstDay = (firstDayIndex + 6) % 7;

  // Jumlah hari bulan ini
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Navigasi Bulan
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  const formatDateString = (d) => {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    return `${year}-${mStr}-${dStr}`;
  };

  // Filter Agenda
  const filteredEvents = SAMPLE_EVENTS.filter((ev) => {
    if (activeFilter === 'all') return true;
    return ev.type === activeFilter;
  });

  const selectedDayEvents = SAMPLE_EVENTS.filter((ev) => ev.date === selectedDateStr);

  const getEventBadge = (type) => {
    switch (type) {
      case 'exam':
        return <span className="event-badge badge-exam"><Award size={12} /> Ujian / UTS</span>;
      case 'class':
        return <span className="event-badge badge-class"><BookOpen size={12} /> Perkuliahan</span>;
      case 'deadline':
        return <span className="event-badge badge-deadline"><Clock size={12} /> Batas Tugas</span>;
      case 'holiday':
        return <span className="event-badge badge-holiday"><Bell size={12} /> Libur</span>;
      default:
        return null;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <TopBarClock />
        <div className="container calendar-page-container">

          {/* Header */}
          <div className="page-header animate-fadeIn">
            <div>
              <h1>Kalender <span className="gradient-text">Akademik & Perkuliahan</span></h1>
              <p>Jadwal perkuliahan, agenda ujian tengah semester, dan tanggal penting akademik</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="calendar-filter-bar glass-card animate-fadeIn">
            <div className="filter-group-buttons">
              <button
                type="button"
                className={`cal-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                Semua Agenda
              </button>
              <button
                type="button"
                className={`cal-filter-btn ${activeFilter === 'class' ? 'active' : ''}`}
                onClick={() => setActiveFilter('class')}
              >
                Perkuliahan
              </button>
              <button
                type="button"
                className={`cal-filter-btn ${activeFilter === 'exam' ? 'active' : ''}`}
                onClick={() => setActiveFilter('exam')}
              >
                Ujian & Kuis
              </button>
              <button
                type="button"
                className={`cal-filter-btn ${activeFilter === 'holiday' ? 'active' : ''}`}
                onClick={() => setActiveFilter('holiday')}
              >
                Libur Akademik
              </button>
            </div>

            <button type="button" className="btn btn-secondary btn-sm" onClick={goToToday}>
              Hari Ini
            </button>
          </div>

          <div className="calendar-layout-grid animate-fadeIn">
            {/* Kalender Grid */}
            <div className="calendar-main-card card">
              <div className="calendar-nav-header">
                <h2 className="calendar-current-month">
                  {MONTH_NAMES[month]} {year}
                </h2>
                <div className="calendar-nav-arrows">
                  <button onClick={prevMonth} className="btn-cal-nav" title="Bulan Sebelumnya">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={nextMonth} className="btn-cal-nav" title="Bulan Berikutnya">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Nama Hari */}
              <div className="calendar-weekdays-grid">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="weekday-header-cell">{d}</div>
                ))}
              </div>

              {/* Grid Hari */}
              <div className="calendar-days-grid">
                {/* Empty cells before first day */}
                {Array.from({ length: adjustedFirstDay }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="calendar-day-cell empty" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNumber = idx + 1;
                  const dateStr = formatDateString(dayNumber);
                  const isSelected = dateStr === selectedDateStr;
                  const hasEvents = SAMPLE_EVENTS.filter((e) => e.date === dateStr);

                  return (
                    <div
                      key={dayNumber}
                      className={`calendar-day-cell ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedDateStr(dateStr)}
                    >
                      <span className="day-number">{dayNumber}</span>
                      {hasEvents.length > 0 && (
                        <div className="day-event-dots">
                          {hasEvents.map((e) => (
                            <span key={e.id} className={`event-dot dot-${e.type}`} title={e.title} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Agenda Hari Ini / Terpilih */}
            <div className="calendar-sidebar-card card">
              <div className="agenda-header">
                <h3>Agenda: {selectedDateStr}</h3>
                <span className="agenda-count-badge">
                  {selectedDayEvents.length} Kegiatan
                </span>
              </div>

              <div className="agenda-events-list">
                {selectedDayEvents.length === 0 ? (
                  <div className="agenda-empty">
                    <CalendarIcon size={36} />
                    <p>Tidak ada kegiatan terjadwal pada tanggal ini.</p>
                  </div>
                ) : (
                  selectedDayEvents.map((ev) => (
                    <div key={ev.id} className={`agenda-item card ${ev.type}`}>
                      <div className="agenda-item-top">
                        {getEventBadge(ev.type)}
                        <span className="agenda-time">
                          <Clock size={12} /> {ev.time}
                        </span>
                      </div>
                      <h4 className="agenda-title">{ev.title}</h4>
                      <p className="agenda-course">{ev.course} • {ev.room}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Seluruh Agenda Mendatang */}
              <div className="upcoming-section">
                <h4>Seluruh Jadwal Bulan Ini</h4>
                <div className="upcoming-list">
                  {filteredEvents.map((ev) => (
                    <div key={ev.id} className="upcoming-mini-item" onClick={() => setSelectedDateStr(ev.date)}>
                      <div className="upcoming-date-col">
                        <span className="upcoming-date-d">{ev.date.split('-')[2]}</span>
                        <span className="upcoming-date-m">Sep</span>
                      </div>
                      <div className="upcoming-info-col">
                        <span className="upcoming-item-title">{ev.title}</span>
                        <span className="upcoming-item-sub">{ev.course}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>
        <Footer />
      </main>
    </div>
  );
}
