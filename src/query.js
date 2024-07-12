const latestNews = (db) => {
    // Delete old news and insert updates
    const update = async (deletions, updates) => {
        const stmts = [
            db.prepare('DELETE FROM latest_news WHERE url = ?'),
            db.prepare('INSERT INTO latest_news (title, url, thumbnail) VALUES (?, ?, ?)'),
        ]

        await db.batch([
            ...deletions.map((n) => stmts[0].bind(n.url)),
            ...updates.map((n) => stmts[1].bind(n.title, n.url, n.thumbnail)),
        ])
    }

    // List all news
    const list = async () =>
        (await db.prepare('SELECT title, url, thumbnail FROM latest_news ORDER BY id ASC').all()).results

    return {
        update,
        list,
    }
}

// News to be sent to discord channels
const pendingNews = (db) => {
    // Insert news into temp table and cross join with channels
    const insert = async (newsEmbeds) => {
        const stmts = [
            db.prepare('CREATE TABLE news (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT)'),
            db.prepare('INSERT INTO news (body) VALUES (?)'),
            db.prepare(
                'INSERT INTO pending_news (channel_id, body) SELECT channels.id, news.body FROM news CROSS JOIN channels ORDER BY news.id ASC'
            ),
            db.prepare('DROP TABLE news'),
        ]

        await db.batch([
            stmts[0],
            ...newsEmbeds.map((embeds) => stmts[1].bind(JSON.stringify({ embeds }))),
            stmts[2],
            stmts[3],
        ])
    }

    // Get the first pending news
    const getFirst = async () => {
        const stmt = db.prepare('SELECT channel_id AS channelId, body FROM pending_news ORDER BY id ASC LIMIT 1')
        return await stmt.first()
    }

    // Delete the first pending news
    const deleteFirst = async () => {
        await db
            .prepare('DELETE FROM pending_news WHERE id = (SELECT id FROM pending_news ORDER BY id ASC LIMIT 1)')
            .run()
    }

    return {
        insert,
        getFirst,
        deleteFirst,
    }
}

const channels = (db) => {
    const get = async (id) => await db.prepare('SELECT * FROM channels WHERE id = ?').bind(id).first()
    const subscribe = async (id) => await db.prepare('INSERT OR IGNORE INTO channels (id) VALUES (?)').bind(id).run()
    const unsubscribe = async (id) => await db.prepare('DELETE FROM channels WHERE id = ?').bind(id).run()

    return {
        get,
        subscribe,
        unsubscribe,
    }
}

const query = {
    latestNews,
    pendingNews,
    channels,
}

export default query
