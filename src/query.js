const latestNews = (db) => {
    // Delete old news and insert updates
    const update = async (deletions, updates) => {
        const stmts = [
            db.prepare('DELETE FROM latest_news WHERE url = ?'),
            db.prepare('INSERT INTO latest_news (title, url, thumbnail, category) VALUES (?, ?, ?, ?)'),
        ]

        await db.batch([
            ...deletions.map((n) => stmts[0].bind(n.url)),
            ...updates.map((n) => stmts[1].bind(n.title, n.url, n.thumbnail, n.category)),
        ])
    }

    // List all news
    const list = async () => (await db.prepare('SELECT title, url, thumbnail, category FROM latest_news ORDER BY id ASC').all()).results

    return {
        update,
        list,
    }
}

// News to be sent to discord channels
const pendingNews = (db) => {
    // Insert pending news based on the news category subscribed to each channel
    const insert = async (newsEmbeds) => {
        const stmts = [
            db.prepare('CREATE TABLE news (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT, category TEXT)'),
            db.prepare('INSERT INTO news (body, category) VALUES (?, ?)'),
            db.prepare(
                'INSERT INTO pending_news (channel_id, body) SELECT cs.channel_id, news.body FROM news JOIN channel_subscriptions cs ON news.category = cs.category ORDER BY news.id ASC'
            ),
            db.prepare('DROP TABLE news'),
        ]

        await db.batch([
            stmts[0],
            ...newsEmbeds.map((embeds) => stmts[1].bind(JSON.stringify({ embeds }), embeds[0].category)),
            stmts[2],
            stmts[3],
        ])
    }

    // Get the first pending news
    const getFirst = async () => await db.prepare('SELECT channel_id AS channelId, body FROM pending_news ORDER BY id ASC LIMIT 1').first()

    // Delete the first pending news
    const deleteFirst = async () =>
        await db.prepare('DELETE FROM pending_news WHERE id = (SELECT id FROM pending_news ORDER BY id ASC LIMIT 1)').run()

    return {
        insert,
        getFirst,
        deleteFirst,
    }
}

const channels = (db) => {
    // Check if a channel is subscribed to any category
    const get = async (id) => !!(await db.prepare('SELECT * FROM channel_subscriptions WHERE channel_id = ? LIMIT 1').bind(id).first())

    // Insert channel subscriptions with categories
    const subscribe = async (id, categories) => {
        const stmts = [
            db.prepare('DELETE FROM channel_subscriptions WHERE channel_id = ?'),
            db.prepare('INSERT INTO channel_subscriptions (channel_id, category) VALUES (?, ?)'),
        ]

        await db.batch([stmts[0].bind(id), ...categories.map((category) => stmts[1].bind(id, category))])
    }

    // Delete channel from channel subscriptions and pending news
    const unsubscribe = async (id) => {
        const stmts = [
            db.prepare('DELETE FROM channel_subscriptions WHERE channel_id = ?'),
            db.prepare('DELETE FROM pending_news WHERE channel_id = ?'),
        ]

        await db.batch([stmts[0].bind(id), stmts[1].bind(id)])
    }

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
