import { Feed } from 'feed'
import { parse } from 'node-html-parser'
import query from './query'

const baseurl = 'https://tw.toram.jp'
const path = '/information/?type_code=all'
const url = `${baseurl}${path}`
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
}

// Return news in ascending order
async function fetchNews() {
    const news = []
    const response = await fetch(url, { headers })

    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${url}, status code: ${response.status}`)
    }

    const content = await response.text()
    const root = parse(content)
    const newsNodeList = root.querySelectorAll('div.useBox > ul > li.news_border')

    for (const newsNode of newsNodeList) {
        const date = newsNode.querySelector('time').getAttribute('datetime')
        const title = newsNode.querySelector('p.news_title').text
        const link = `${baseurl}${newsNode.querySelector('a').getAttribute('href')}`
        const thumbnail = newsNode.querySelector('img').getAttribute('src')

        news.unshift({
            date,
            title,
            link,
            thumbnail,
        })
    }

    return news
}

async function fetchNewsImage(link) {
    // Delay avoid being blocked
    await new Promise((resolve) => setTimeout(resolve, 1000))

    try {
        const response = await fetch(link, { headers })
        if (response.status !== 200) return undefined

        const content = await response.text()
        const root = parse(content)
        const img = root.querySelector('div.useBox.newsBox')?.querySelector('img')?.getAttribute('src')

        return img
    } catch (error) {
        console.error(error)
        return undefined
    }
}

async function updateLatestNews(queryLatestNews, news) {
    const updates = []

    // Check for updates
    for (const item of news) {
        if (!(await queryLatestNews.includes(item))) {
            item.img = await fetchNewsImage(item.link)
            updates.push(item)
        }
    }

    // Update latest news and keep only the last 10 news
    await queryLatestNews.insert(updates)
    await queryLatestNews.deleteOld()

    return updates
}

async function generateFeed(kv, news) {
    const feed = new Feed({
        title: '托蘭異世錄官網 - Toram Online -',
        description: '托蘭異世錄官網 - Toram Online - 公告',
        id: url,
        link: url,
        language: 'zh-TW',
        image: `${baseurl}/favicon.ico`,
        favicon: `${baseurl}/favicon.ico`,
        updated: new Date(),
    })

    for (const item of news) {
        feed.addItem({
            title: item.title,
            id: item.link,
            link: item.link,
            date: new Date(item.date),
            image: item.img,
        })
    }

    await kv.put('/toram', feed.rss2())
}

function postDiscordWebhook(webhookUrl, news) {
    try {
        return fetch(`${webhookUrl}?wait=true`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                embeds: [
                    {
                        title: `[${news.date}] ${news.title}`,
                        url: news.link,
                        image: {
                            url: news.img || undefined,
                        },
                        thumbnail: {
                            url: news.thumbnail || undefined,
                        },
                    },
                ],
            }),
        })
    } catch (error) {
        console.error(error)
        return undefined
    }
}

async function insertPendingNews(queryWebhooks, queryPendingNews, updates) {
    const webhooks = await queryWebhooks.list()
    const pendingNews = []

    for (const news of updates) {
        for (const webhook of webhooks) {
            pendingNews.push({ ...news, webhookId: webhook.id })
        }
    }

    await queryPendingNews.insert(pendingNews)
}

async function sendPendingNews(queryPendingNews) {
    while (true) {
        const news = await queryPendingNews.getFirst()
        if (!news) break

        // Retry 5 times
        let success = false
        for (let i = 1; i <= 5; i++) {
            const res = await postDiscordWebhook(news.webhookUrl, news)
            if (res?.status === 200) {
                success = true
                break
            }
            console.error(`Failed to post webhook ${news.webhookUrl}, status code: ${res?.status}`)
            await new Promise((resolve) => setTimeout(resolve, 1000 * i))
        }

        if (!success) {
            throw new Error(`Failed to post webhook ${news.webhookUrl}`)
        }

        await queryPendingNews.deleteFirst()
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }
}

export default {
    async scheduled(event, env, ctx) {
        const queryLatestNews = query.latestNews(env.TORAM)
        const queryWebhooks = query.webhooks(env.TORAM)
        const queryPendingNews = query.pendingNews(env.TORAM)

        const news = await fetchNews()
        const updates = await updateLatestNews(queryLatestNews, news)

        if (updates.length) {
            const updatedNews = await queryLatestNews.list()
            await generateFeed(env.FEEDS, updatedNews)
            await insertPendingNews(queryWebhooks, queryPendingNews, updates)
        }

        await sendPendingNews(queryPendingNews)
    },
}
