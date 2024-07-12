import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import { parse } from 'node-html-parser'
import { convert } from 'html-to-text'
import query from './query'
import command from './commands'

const baseurl = 'https://tw.toram.jp'
const path = '/information'
const url = `${baseurl}${path}`
const headers = {
    'User-Agent':
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
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
        const title = newsNode.querySelector('p.news_title').text
        const url = `${baseurl}${newsNode.querySelector('a').getAttribute('href')}`
        const thumbnail = newsNode.querySelector('img').getAttribute('src')

        news.unshift({
            title,
            url,
            thumbnail,
        })
    }

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
                { selector: 'details', format: 'blockString', options: { string: '點擊連結查看詳情' } },
            ],
        }).replace(/\n{3,}/g, '\n\n')

        const images = section.querySelectorAll('img').map((img) => ({ url: img.getAttribute('src') }))

        embeds.push({
            title,
            url,
            thumbnail,
            description,
            image: images.shift(),
        })

        for (const image of images) {
            embeds.push({ url, image })
        }
    }

    return embeds
}

async function checkNewsDifference(queryLatestNews, news) {
    const latestNews = await queryLatestNews.list()
    const latestNewsSet = new Set(latestNews.map((n) => JSON.stringify(n)))
    const newsSet = new Set(news.map((n) => JSON.stringify(n)))

    const deletions = [...latestNewsSet.difference(newsSet)].map((n) => JSON.parse(n))
    const updates = [...newsSet.difference(latestNewsSet)].map((n) => JSON.parse(n))

    return {
        deletions,
        updates,
    }
}

async function generateNewsEmbeds(updates) {
    const newsEmbeds = []

    for (const news of updates) {
        const embeds = await fetchNewsContent(news)
        newsEmbeds.push(embeds)
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    function* chunks(arr, n) {
        for (let i = 0; i < arr.length; i += n) {
            yield arr.slice(i, i + n)
        }
    }

    // Split into chunks of 10 for Discord embeds limit
    return newsEmbeds.flatMap((embeds) => [...chunks(embeds, 10)])
}

async function sendPendingNews(queryPendingNews, queryChannels, token) {
    const rest = new REST({ rejectOnRateLimit: ['/channels'] }).setToken(token)

    while (true) {
        const news = await queryPendingNews.getFirst()
        if (!news) break

        try {
            await rest.post(Routes.channelMessages(news.channelId), {
                body: news.body,
                headers: { 'content-type': 'application/json' },
                passThroughBody: true,
            })
            await queryPendingNews.deleteFirst()
            await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
            // Handle 50001: Missing Access, 10003: Unknown Channel
            if (error.code === 50001 || error.code === 10003) {
                await queryChannels.unsubscribe(news.channelId)
            } else {
                throw error
            }
        }
    }
}

function InteractionResponse(data) {
    return new Response(JSON.stringify(data), {
        headers: {
            'content-type': 'application/json',
        },
    })
}

async function handleInteraction(request, env) {
    const interaction = await request.json()
    const queryChannels = query.channels(env.TORAM)

    if (interaction.type === InteractionType.PING) {
        return InteractionResponse({ type: InteractionResponseType.PONG })
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        switch (interaction.data.name) {
            case command.SUBSCRIBE.name:
                if (await queryChannels.get(interaction.channel_id)) {
                    return InteractionResponse({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: '已訂閱！' },
                    })
                } else {
                    await queryChannels.subscribe(interaction.channel_id)
                    return InteractionResponse({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: '訂閱成功！' },
                    })
                }
            case command.UNSUBSCRIBE.name:
                if (!(await queryChannels.get(interaction.channel_id))) {
                    return InteractionResponse({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: '未訂閱！' },
                    })
                } else {
                    await queryChannels.unsubscribe(interaction.channel_id)
                    return InteractionResponse({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: '取消訂閱成功！' },
                    })
                }
        }
    }

    return new Response('Bad request.', { status: 400 })
}

export default {
    async scheduled(event, env, ctx) {
        const queryLatestNews = query.latestNews(env.TORAM)
        const queryPendingNews = query.pendingNews(env.TORAM)
        const queryChannels = query.channels(env.TORAM)

        const news = await fetchNews()
        const { deletions, updates } = await checkNewsDifference(queryLatestNews, news)

        if (updates.length) {
            const newsEmbeds = await generateNewsEmbeds(updates)
            await queryPendingNews.insert(newsEmbeds)
            await queryLatestNews.update(deletions, updates)
        }

        await sendPendingNews(queryPendingNews, queryChannels, env.DISCORD_BOT_TOKEN)
    },
    async fetch(request, env, ctx) {
        // Handle Discord interactions
        if (request.method === 'POST') {
            const signature = request.headers.get('x-signature-ed25519')
            const timestamp = request.headers.get('x-signature-timestamp')
            const body = await request.clone().arrayBuffer()
            const isValidRequest = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY)

            if (!isValidRequest) {
                return new Response('Bad request signature.', { status: 401 })
            }

            return handleInteraction(request, env)
        } else {
            return new Response('Method Not Allowed.', { status: 405 })
        }
    },
}
