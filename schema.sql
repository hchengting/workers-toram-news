DROP TABLE IF EXISTS latest_news;
DROP TABLE IF EXISTS pending_news;
DROP TABLE IF EXISTS channel_subscriptions;

CREATE TABLE IF NOT EXISTS latest_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail TEXT NOT NULL,
    UNIQUE (date, category, title, url, thumbnail)
);

CREATE TABLE IF NOT EXISTS pending_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    body TEXT NOT NULL,
    retrieved_at NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS channel_subscriptions (
    channel_id TEXT NOT NULL,
    category TEXT NOT NULL,
    PRIMARY KEY (channel_id, category)
);
