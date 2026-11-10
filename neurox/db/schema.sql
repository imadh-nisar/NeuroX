-- NeuroX database schema (MariaDB 10.6+ or MySQL 8+)
-- Aggregated district figures only. No individual-level records.
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS age_sex_year;
DROP TABLE IF EXISTS district_year;
DROP TABLE IF EXISTS district_2024;
DROP TABLE IF EXISTS source_files;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS districts;

CREATE TABLE districts (
  id INT PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  province VARCHAR(64) NOT NULL,
  lat DECIMAL(9,6) NOT NULL,
  lon DECIMAL(9,6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE source_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_name VARCHAR(255) NOT NULL,
  edition VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  downloaded_on DATE NULL,
  is_synthetic TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE district_2024 (
  district_id INT PRIMARY KEY,
  population INT NOT NULL,
  psych_clinic_visits INT NULL,
  psychiatrists INT NULL,
  psych_beds INT NULL,
  mental_hospitalisations INT NULL,
  psych_visits_per_100k DECIMAL(10,2) NULL,
  psychiatrists_per_100k DECIMAL(8,2) NULL,
  beds_per_100k DECIMAL(10,2) NULL,
  mh_hosp_per_100k DECIMAL(10,2) NULL,
  visits_per_psychiatrist DECIMAL(10,0) NULL,
  facilities_listed INT NULL,
  service_use_score DECIMAL(6,1) NULL,
  decision_key VARCHAR(16) NOT NULL,
  decision_label VARCHAR(64) NOT NULL,
  decision_reason TEXT NOT NULL,
  CONSTRAINT fk_d2024_district FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
