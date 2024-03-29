--ERD: https://dbdiagram.io/d

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL
      CHECK (position('@' IN email) > 1),
    profile_img TEXT,
    bio TEXT,
    verified BOOLEAN DEFAULT FALSE
);
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    source_name TEXT NOT NULL,
    author TEXT,
    title TEXT NOT NULL,
    content TEXT,
    description TEXT,
    date_created DATE NOT NULL,
    source_link TEXT NOT NULL
);

ALTER TABLE messages ADD CONSTRAINT unique_title_source_name unique(title,source_name, author);

CREATE TABLE folders(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL 
    REFERENCES users ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT
);

ALTER TABLE folders ADD CONSTRAINT unique_folders unique(user_id,name);

CREATE TABLE sources(   --RSS, Twitter, Reddit, etc.
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  img TEXT NOT NULL,
  token BOOLEAN DEFAULT FALSE
);

CREATE TABLE reactions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    img TEXT NOT NULL
);

CREATE TABLE feeds(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL 
    REFERENCES users ON DELETE CASCADE,
  folder_id INTEGER
    REFERENCES folders ON DELETE SET NULL,
  source_id INTEGER
    REFERENCES sources ON DELETE SET NULL,
  feed_name TEXT NOT NULL
);

CREATE TABLE calls(  --User will not make calls every time.  Call info will need to be stored.
  id SERIAL PRIMARY KEY,
  feed_id INTEGER NOT NULL
    REFERENCES feeds ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  request_body TEXT,
  request_params TEXT,
  request_headers TEXT
);

CREATE TABLE bookmarks(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL
    REFERENCES users ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'bookmark.png'
);

CREATE TABLE user_messages(
  user_id INTEGER NOT NULL
    REFERENCES users ON DELETE CASCADE,
  message_id INTEGER NOT NULL
    REFERENCES messages ON DELETE CASCADE,
  feed_id INTEGER
    REFERENCES feeds ON DELETE SET NULL,
  bookmark_id INTEGER DEFAULT NULL
    REFERENCES bookmarks ON DELETE SET NULL,
  notes TEXT,
  clicks INTEGER DEFAULT 0,
  react_id INTEGER DEFAULT NULL
    REFERENCES reactions ON DELETE SET NULL,
  seen BOOLEAN DEFAULT FALSE
);

ALTER TABLE user_messages ADD CONSTRAINT unique_user_messages unique(user_id,message_id);