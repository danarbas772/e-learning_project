-- ====================================================================
-- SCRIPT PERBAIKAN DATABASE (Jalankan di phpMyAdmin -> Tab "SQL")
-- Basis Data: basdev_dbelearning
-- 
-- Mengatasi 3 Masalah Sekaligus:
-- 1. "Unknown column 'attendance_active' in 'SELECT'" (Aktifkan Presensi)
-- 2. Error 500 saat Bagikan Pengumuman / File (Announcements)
-- 3. Error 500 saat Simpan & Terbitkan Ujian / Kuis (Quizzes)
-- ====================================================================

-- 1. Perbaikan Tabel sections (Presensi Sesi Pertemuan)
ALTER TABLE `sections` 
  ADD COLUMN IF NOT EXISTS `attendance_active` BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS `attendance_open` BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS `attendance_started_at` TIMESTAMP NULL;

-- 2. Perbaikan Tabel attendance (Presensi Kehadiran Mahasiswa)
ALTER TABLE `attendance` 
  ADD COLUMN IF NOT EXISTS `student_name` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `student_nim` VARCHAR(50) NULL;

-- 3. Perbaikan Tabel announcements (Pengumuman & Lampiran File)
ALTER TABLE `announcements` 
  ADD COLUMN IF NOT EXISTS `file_size` BIGINT NULL,
  ADD COLUMN IF NOT EXISTS `author_id` INT NULL,
  ADD COLUMN IF NOT EXISTS `author_name` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `created_by` INT NULL,
  MODIFY COLUMN `created_by` INT NULL;

-- 4. Perbaikan Tabel comments (Forum & Balasan Pengumuman)
ALTER TABLE `comments` 
  ADD COLUMN IF NOT EXISTS `announcement_id` INT NULL,
  ADD COLUMN IF NOT EXISTS `user_role` VARCHAR(50) DEFAULT 'student';

-- 5. Perbaikan Tabel quizzes (Pembuatan Ujian & Kuis)
ALTER TABLE `quizzes` 
  ADD COLUMN IF NOT EXISTS `quiz_type` VARCHAR(50) DEFAULT 'multiple_choice',
  ADD COLUMN IF NOT EXISTS `start_time` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `end_time` DATETIME NULL;

-- 6. Perbaikan Tabel questions (Dukungan Soal Pilihan Ganda & Esai)
ALTER TABLE `questions` 
  MODIFY COLUMN `question_type` ENUM('multiple_choice', 'true_false', 'short_answer', 'essay') DEFAULT 'multiple_choice';
