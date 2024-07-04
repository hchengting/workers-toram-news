import { Feed } from 'feed'
import { parse } from 'node-html-parser'
import { convert } from 'html-to-text'
import query from './query'

const baseurl = 'https://tw.toram.jp'
const path = '/information/?type_code=all'
const url = `${baseurl}${path}`
const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
}

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
        const url = `${baseurl}${newsNode.querySelector('a').getAttribute('href')}`
        const thumbnail = newsNode.querySelector('img').getAttribute('src')

        news.push({
            date,
            title,
            url,
            thumbnail,
        })
    }

    // Newest first
    return news
}

async function fetchNewsContent(news) {
    const embeds = []
    const response = await fetch(news.url, { headers })

    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${news.url}, status code: ${response.status}`)
    }

    const content = await response.text()
    const root = parse(content)
    const newsBox = root.querySelector('div.useBox.newsBox')
    const children = newsBox.childNodes.slice(
        newsBox.childNodes.findIndex((child) => child.classList?.contains('smallTitleLine')) + 1,
        newsBox.childNodes.findIndex((child) => child.classList?.contains('deluxetitle') && child.text === '注意事項')
    )

    const sections = [[null]]

    for (const child of children) {
        if (child.text === '回頁面頂端') continue

        if (child.classList?.contains('deluxetitle') && child.id) {
            sections.push([child])
        } else {
            sections[sections.length - 1].push(child)
        }
    }

    for (const [head, ...contents] of sections) {
        const title = head === null ? news.title : head.text
        const url = head === null ? news.url : `${news.url}#${head.id}`
        const thumbnail = head === null ? { url: news.thumbnail } : undefined

        const section = parse(contents.join(''))
        const description = convert(section.toString(), {
            wordwrap: false,
            selectors: [
                { selector: 'a', options: { baseUrl: 'https:', linkBrackets: false } },
                { selector: 'hr', format: 'skip' },
                { selector: 'img', format: 'skip' },
                { selector: 'button', format: 'skip' },
                { selector: 'table', format: 'dataTable' },
            ],
        }).replace(/\n{3,}/g, '\n\n')

        const images = section.querySelectorAll('img').map((img) => ({ url: img.getAttribute('src') }))

        embeds.push({
            title,
            url,
            description,
            thumbnail,
            image: images.shift(),
        })

        for (const image of images) {
            embeds.push({ url, image })
        }
    }

    return embeds
}

async function checkNewsUpdates(queryLatestNews, news) {
    const latestNews = await queryLatestNews.list()
    const latestNewsTitles = new Set(latestNews.map((n) => n.title))
    const latestNewsUrls = new Set(latestNews.map((n) => n.url))

    // Check for updates
    const updates = news.filter((item) => !latestNewsTitles.has(item.title) || !latestNewsUrls.has(item.url)).reverse()

    // Oldest first
    return updates
}

async function generateNewsEmbeds(updates) {
    const newsEmbeds = []

    for (const news of updates) {
        const embeds = await fetchNewsContent(news)
        newsEmbeds.push(embeds)
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return newsEmbeds
}

async function generateFeed(kv, queryLatestNews) {
    const news = (await queryLatestNews.list()).reverse()

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
            id: item.url,
            link: item.url,
            date: new Date(item.date),
            image: item.img,
        })
    }

    await kv.put('/toram', feed.rss2())
}

function postDiscordWebhook(news) {
    const { webhookUrl, body } = news

    try {
        return fetch(`${webhookUrl}?wait=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        })
    } catch (error) {
        console.error(error)
        return undefined
    }
}

async function sendPendingNews(queryPendingNews) {
    while (true) {
        const news = await queryPendingNews.getFirst()
        if (!news) break

        // Retry 5 times
        let success = false
        for (let i = 1; i <= 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * i))
            const res = await postDiscordWebhook(news)
            if (res?.status === 200) {
                success = true
                break
            }
            console.error(`Failed to post webhook ${news.webhookUrl}, status code: ${res?.status}`)
        }

        if (!success) {
            throw new Error(`Failed to post webhook ${news.webhookUrl}`)
        }

        await queryPendingNews.deleteFirst()
    }
}

export default {
    async scheduled(event, env, ctx) {
        const queryLatestNews = query.latestNews(env.TORAM)
        const queryPendingNews = query.pendingNews(env.TORAM)

        const news = await fetchNews()
        const updates = await checkNewsUpdates(queryLatestNews, news)

        if (updates.length) {
            const newsEmbeds = await generateNewsEmbeds(updates)
            await queryLatestNews.insert(updates, newsEmbeds)
            await queryPendingNews.insert(newsEmbeds)
            await generateFeed(env.FEEDS, queryLatestNews)
        }

        await sendPendingNews(queryPendingNews)
    },
}
