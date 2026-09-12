-- =======================================================
-- SQL SETUP SINGLE DATABASE (untuk cPanel / Hosting)
-- Semua tabel dalam 1 database: CPANEL_USERNAME_elearning
-- 
-- CARA PAKAI:
-- 1. Buat database di cPanel → MySQL Databases
-- 2. Buka phpMyAdmin, pilih database Anda
-- 3. Klik tab "SQL", paste seluruh isi file ini, klik Go
-- =======================================================

-- ─── TABEL AUTH (users) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'instructor', 'student') NOT NULL DEFAULT 'student',
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`)
);

-- Default Admin (email: admin@elearning.com | password: Admin@123)
INSERT IGNORE INTO `users` (`email`, `password_hash`, `role`) VALUES 
('admin@elearning.com', '$2a$12$rLNfCOMNbSruJfq7MOBfQONT5q6gpVsZoeBLPcL0yn2Kav7PX4oSS', 'admin');


-- ─── TABEL USER (profiles) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `full_name` VARCHAR(255) NOT NULL,
  `nim_nip` VARCHAR(50),
  `avatar_url` VARCHAR(512),
  `phone` VARCHAR(20),
  `bio` TEXT,
  `department` VARCHAR(255),
  `academic_year` VARCHAR(10),
  `semester` INT DEFAULT 1,
  `role` ENUM('admin', 'instructor', 'student') NOT NULL DEFAULT 'student',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_nim_nip` (`nim_nip`)
);


-- ─── TABEL COURSE ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `courses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `instructor_id` INT NOT NULL,
  `instructor_name` VARCHAR(255),
  `thumbnail_url` VARCHAR(512),
  `category` VARCHAR(100),
  `department` VARCHAR(100),
  `level` ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  `curriculum` VARCHAR(100) DEFAULT 'Kurikulum Merdeka',
  `course_code` VARCHAR(50),
  `semester` INT DEFAULT 1,
  `sks` INT DEFAULT 3,
  `total_sessions` INT DEFAULT 16,
  `is_published` BOOLEAN DEFAULT TRUE,
  `is_free` BOOLEAN DEFAULT TRUE,
  `price` DECIMAL(10, 2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_instructor` (`instructor_id`),
  INDEX `idx_category` (`category`),
  INDEX `idx_published` (`is_published`)
);

CREATE TABLE IF NOT EXISTS `sections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `order_index` INT DEFAULT 0,
  `attendance_open` BOOLEAN DEFAULT FALSE,
  `attendance_started_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `materials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `section_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `material_type` ENUM('pdf', 'ppt', 'pptx', 'video', 'link', 'text', 'youtube', 'doc') NOT NULL,
  `file_url` VARCHAR(512),
  `file_name` VARCHAR(255),
  `file_size` BIGINT,
  `external_url` VARCHAR(512),
  `content` TEXT,
  `order_index` INT DEFAULT 0,
  `is_downloadable` BOOLEAN DEFAULT TRUE,
  `uploaded_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `course_access_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `user_id` INT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `nim_nip` VARCHAR(50) NULL,
  `academic_year` VARCHAR(20) NULL,
  `semester` INT NULL,
  `rule_type` ENUM('student', 'year', 'name') DEFAULT 'student',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
  INDEX `idx_course_access` (`course_id`)
);

CREATE TABLE IF NOT EXISTS `announcements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT,
  `file_url` VARCHAR(512),
  `file_name` VARCHAR(255),
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `comments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `session_id` INT,
  `parent_id` INT NULL,
  `user_id` INT NOT NULL,
  `user_name` VARCHAR(255),
  `comment_text` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `section_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `attended_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_attendance` (`section_id`, `student_id`)
);


-- ─── TABEL ENROLLMENT ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `enrollments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `status` ENUM('active', 'completed', 'dropped') DEFAULT 'active',
  `enrolled_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  UNIQUE KEY `unique_enrollment` (`user_id`, `course_id`)
);

CREATE TABLE IF NOT EXISTS `material_progress` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `material_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `is_completed` BOOLEAN DEFAULT FALSE,
  `completed_at` TIMESTAMP NULL,
  UNIQUE KEY `unique_progress` (`user_id`, `material_id`)
);


-- ─── TABEL QUIZ ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `quizzes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `section_id` INT,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `time_limit_minutes` INT DEFAULT 0,
  `passing_score` INT DEFAULT 70,
  `created_by` INT NOT NULL,
  `is_published` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` INT NOT NULL,
  `question_text` TEXT NOT NULL,
  `question_type` ENUM('multiple_choice', 'true_false', 'short_answer', 'essay') DEFAULT 'multiple_choice',
  `points` INT DEFAULT 1,
  `order_index` INT DEFAULT 0,
  FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `answer_options` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `question_id` INT NOT NULL,
  `option_text` VARCHAR(512) NOT NULL,
  `is_correct` BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `quiz_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `score` DECIMAL(5, 2),
  `max_score` INT,
  `is_passed` BOOLEAN,
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS `attempt_answers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `attempt_id` INT NOT NULL,
  `question_id` INT NOT NULL,
  `selected_option_id` INT,
  `text_answer` TEXT,
  `is_correct` BOOLEAN,
  FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON DELETE CASCADE
);

-- =======================================================
-- SELESAI! Semua tabel berhasil dibuat dalam 1 database.
-- Login Admin: admin@elearning.com / Admin@123
-- =======================================================
