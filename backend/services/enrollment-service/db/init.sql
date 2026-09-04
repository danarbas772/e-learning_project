-- Database untuk Enrollment Service
CREATE DATABASE IF NOT EXISTS elearning_enrollments;
USE elearning_enrollments;

CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  status ENUM('active', 'completed', 'dropped') DEFAULT 'active',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY unique_enrollment (user_id, course_id),
  INDEX idx_user (user_id),
  INDEX idx_course (course_id)
);

CREATE TABLE IF NOT EXISTS material_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  material_id INT NOT NULL,
  course_id INT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY unique_progress (user_id, material_id),
  INDEX idx_user_course (user_id, course_id)
);
