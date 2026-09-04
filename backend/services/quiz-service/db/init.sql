-- Database untuk Quiz Service
CREATE DATABASE IF NOT EXISTS elearning_quizzes;
USE elearning_quizzes;

CREATE TABLE IF NOT EXISTS quizzes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  section_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit_minutes INT DEFAULT 0,       -- 0 = unlimited
  passing_score INT DEFAULT 70,           -- Nilai minimum lulus (%)
  created_by INT NOT NULL,               -- instructor_id
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course (course_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('multiple_choice', 'true_false', 'short_answer') DEFAULT 'multiple_choice',
  points INT DEFAULT 1,
  order_index INT DEFAULT 0,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answer_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  option_text VARCHAR(512) NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  user_id INT NOT NULL,
  score DECIMAL(5, 2),
  max_score INT,
  is_passed BOOLEAN,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  INDEX idx_user_quiz (user_id, quiz_id)
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option_id INT,
  text_answer TEXT,
  is_correct BOOLEAN,
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE
);
