-- Database untuk Course Service
CREATE DATABASE IF NOT EXISTS elearning_courses;
USE elearning_courses;

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructor_id INT NOT NULL,              -- referensi ke auth_db.users.id
  instructor_name VARCHAR(255),
  thumbnail_url VARCHAR(512),
  category VARCHAR(100),
  level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  is_published BOOLEAN DEFAULT FALSE,
  is_free BOOLEAN DEFAULT TRUE,
  price DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_instructor (instructor_id),
  INDEX idx_category (category),
  INDEX idx_published (is_published)
);

CREATE TABLE IF NOT EXISTS sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course (course_id)
);

CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  material_type ENUM('pdf', 'ppt', 'pptx', 'video', 'link', 'text') NOT NULL,
  file_url VARCHAR(512),                    -- Path file di server
  file_name VARCHAR(255),                   -- Nama file asli
  file_size BIGINT,                         -- Ukuran dalam bytes
  external_url VARCHAR(512),               -- Untuk tipe 'link'
  content TEXT,                            -- Untuk tipe 'text'
  order_index INT DEFAULT 0,
  is_downloadable BOOLEAN DEFAULT TRUE,
  uploaded_by INT NOT NULL,               -- instructor_id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_section (section_id),
  INDEX idx_course (course_id)
);

-- Aturan akses matkul: jika ada entri, hanya mahasiswa yang cocok yg bisa lihat matkul
CREATE TABLE IF NOT EXISTS course_access_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  user_id INT NULL,
  full_name VARCHAR(255) NOT NULL,
  nim_nip VARCHAR(50) NULL,
  academic_year VARCHAR(20) NULL,
  semester INT NULL,
  rule_type ENUM('student', 'year', 'name') DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course_access (course_id)
);
