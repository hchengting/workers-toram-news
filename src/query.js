const latestNews = (db) => {
    // Batch insert news and keep only the latest 10
    const insert = async (news) => {
        const stmts = [
            db.prepare('INSERT INTO latest_news (date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?)'),
            db.prepare('DELETE FROM latest_news WHERE id NOT IN (SELECT id FROM latest_news ORDER BY id DESC LIMIT 10)'),
        ]
        await db.batch([...news.map((n) => stmts[0].bind(n.date, n.title, n.link, n.thumbnail || '', n.img || '')), stmts[1]])
    }

    // List all news
    const list = async () => (await db.prepare('SELECT * FROM latest_news ORDER BY id ASC').all()).results

    return {
        insert,
        list,
    }
}

// News that are pending for sending to webhooks
const pendingNews = (db) => {
    // Batch insert updates with webhook id into pending news
    const insert = async (updates) => {
        const stmts = [
            db.prepare('CREATE TABLE updates (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, title TEXT, link TEXT, thumbnail TEXT, img TEXT)'),
            db.prepare('INSERT INTO updates (date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?)'),
            db.prepare(
                'INSERT INTO pending_news (webhook_id, date, title, link, thumbnail, img) SELECT webhooks.id, updates.date, updates.title, updates.link, updates.thumbnail, updates.img FROM updates CROSS JOIN webhooks ORDER BY updates.id ASC'
            ),
            db.prepare('DROP TABLE updates'),
        ]

        await db.batch([stmts[0], ...updates.map((n) => stmts[1].bind(n.date, n.title, n.link, n.thumbnail || '', n.img || '')), stmts[2], stmts[3]])
    }

    // Get the first pending news with webhook url
    const getFirst = async () => {
        const stmt = db.prepare(
            'SELECT p.*, w.url AS webhookUrl FROM (SELECT * FROM pending_news ORDER BY id ASC LIMIT 1) AS p JOIN webhooks AS w ON p.webhook_id = w.id'
        )
        return await stmt.first()
    }

    // Delete the first pending news
    const deleteFirst = async () => await db.prepare('DELETE FROM pending_news WHERE id = (SELECT id FROM pending_news ORDER BY id ASC LIMIT 1)').run()

    return {
        insert,
        getFirst,
        deleteFirst,
    }
}

const query = {
    latestNews,
    pendingNews,
}

export default query
