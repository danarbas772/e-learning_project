-- Database untuk User Service
CREATE DATABASE IF NOT EXISTS elearning_users;
USE elearning_users;

CREATE TABLE IF NOT EXISTS profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,         -- referensi ke auth_db.users.id
  full_name VARCHAR(255) NOT NULL,
  nim_nip VARCHAR(50),                 -- NIM untuk mahasiswa, NIP untuk dosen
  avatar_url VARCHAR(512),
  phone VARCHAR(20),
  bio TEXT,
  department VARCHAR(255),            -- Jurusan/Departemen
  academic_year VARCHAR(10),          -- Tahun Akademik (khusus mahasiswa)
  role ENUM('admin', 'instructor', 'student') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_nim_nip (nim_nip)
);
