DROP TABLE IF EXISTS attempts, options, questions, quizzes, users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE quizzes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  time_limit_sec INT NOT NULL DEFAULT 300
);
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL
);
CREATE TABLE options (
  id SERIAL PRIMARY KEY,
  question_id INT REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE attempts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score INT,
  total INT
);

-- Sample quiz
INSERT INTO quizzes(id,title,time_limit_sec) VALUES (1,'Web Technologies Basics',300);
INSERT INTO questions(id,quiz_id,text) VALUES
 (1,1,'What does HTML stand for?'),
 (2,1,'Which CSS property changes text colour?'),
 (3,1,'Which JavaScript method adds an item to the end of an array?'),
 (4,1,'Which HTTP method is normally used to create data in a REST API?'),
 (5,1,'Which JavaScript function runs code repeatedly at a fixed interval?');
INSERT INTO options(question_id,text,is_correct) VALUES
 (1,'HyperText Markup Language',true),(1,'Hyperlinks Text Mark Language',false),(1,'High Tech Modern Language',false),(1,'Home Tool Markup Language',false),
 (2,'color',true),(2,'font-color',false),(2,'text-style',false),(2,'foreground',false),
 (3,'push()',true),(3,'pop()',false),(3,'shift()',false),(3,'slice()',false),
 (4,'POST',true),(4,'GET',false),(4,'DELETE',false),(4,'HEAD',false),
 (5,'setInterval()',true),(5,'setTimeout()',false),(5,'setImmediate()',false),(5,'requestStop()',false);
SELECT setval(pg_get_serial_sequence('quizzes','id'),1);
SELECT setval(pg_get_serial_sequence('questions','id'),5);
