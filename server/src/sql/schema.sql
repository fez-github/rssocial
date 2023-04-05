--ERD: https://dbdiagram.io/d

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL
      CHECK (position('@' IN email) > 1),
    profile_img TEXT,
    bio TEXT
);
CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    source_name TEXT NOT NULL,
    author TEXT,
    title TEXT NOT NULL,
    content TEXT,
    date_created DATE NOT NULL,
    source_link TEXT NOT NULL
);

ALTER TABLE messages ADD CONSTRAINT unique_title_source_name unique(title,source_name)

CREATE TABLE folders(
  folder_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL 
    REFERENCES users ON DELETE CASCADE,
  parent_id INTEGER
  folder_name TEXT NOT NULL,
  icon TEXT
);

CREATE TABLE sources(   --RSS, Twitter, Reddit, etc.
  source_id SERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_img TEXT NOT NULL
);

CREATE TABLE reactions (
    react_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    img TEXT NOT NULL
);

CREATE TABLE calls(  --User will not make calls every time.  Call info will need to be stored.
  call_id SERIAL PRIMARY KEY,
  base_url TEXT NOT NULL,
  request_body TEXT, --Hash any passwords.
  request_params TEXT,
  request_headers TEXT
);

CREATE TABLE feeds(
  feed_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL 
    REFERENCES users ON DELETE CASCADE,
  folder_id INTEGER
    REFERENCES folders ON DELETE SET NULL,
  source_id INTEGER
    REFERENCES sources ON DELETE SET NULL,
  feed_name TEXT NOT NULL,
  call_id INTEGER
    REFERENCES calls ON DELETE SET NULL
);

CREATE TABLE feed_messages(
  message_id INTEGER NOT NULL
    REFERENCES messages ON DELETE CASCADE,
  feed_id INTEGER NOT NULL
    REFERENCES feeds ON DELETE SET NULL
);

CREATE TABLE user_messages(
  user_id INTEGER NOT NULL
    REFERENCES users ON DELETE CASCADE,
  message_id INTEGER NOT NULL
    REFERENCES messages ON DELETE SET NULL,
  notes TEXT,
  clicks INTEGER DEFAULT 0,
  react_id INTEGER DEFAULT 1
    REFERENCES reactions ON DELETE SET NULL,
  seen BOOLEAN DEFAULT FALSE
);

-- Twitter Feed Options:
  -- User/List/Hashtag/Topic(?)/Search result
  -- Minimum number of likes
  -- Show Retweets?
  -- Frequency of calls.

-- Reddit Feed Options:
  -- User/Subreddit
  -- Minimum number of votes
  -- Show crossposts?
  -- Token
  -- Frequency of calls.

-- News Feed Options:
  -- Frequency of calls.