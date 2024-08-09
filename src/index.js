import { Routes, InteractionType, InteractionResponseType, ComponentType } from 'discord-api-types/v10'
import { REST } from '@discordjs/rest'
import { verifyKey } from 'discord-interactions'
import { parse } from 'node-html-parser'
import { convert } from 'html-to-text'
import { categoryMap, componentOptions } from './category'
import command from './command'
import query from './query'

const baseurl = 'https://tw.toram.jp'
const path = '/information'
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
        const title = newsNode.querySelector('p.news_title').text
        const url = `${baseurl}${newsNode.querySelector('a').getAttribute('href')}`
        const thumbnail = newsNode.querySelector('img').getAttribute('src')
        const category = categoryMap[thumbnail.split('icon_news_')[1].split('.')[0]] || ''

        news.unshift({
            title,
            url,
            thumbnail,
            category,
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
        const text = convert(section.toString(), {
            wordwrap: false,
            formatters: {
                markdownLink: (elem, walk, builder, _) => {
                    const text = elem.children?.filter((child) => child.type === 'text')?.length === 1
                    const href = elem.attribs?.href || ''
                    const link = href.startsWith('//') ? `https:${href}` : href.startsWith('#') ? `${news.url}${href}` : ''

                    if (text && link) {
                        builder.startNoWrap()
                        builder.addLiteral(`[`)
                        walk(elem.children, builder)
                        builder.addLiteral(`](`)
                        builder.addInline(link, { noWordTransform: true })
                        builder.addLiteral(`)`)
                        builder.stopNoWrap()
                    } else {
                        walk(elem.children, builder)
                        builder.addInline(link, { noWordTransform: true })
                    }
                },
            },
            selectors: [
                { selector: 'a', format: 'markdownLink' },
                { selector: 'hr', format: 'skip' },
                { selector: 'img', format: 'skip' },
                { selector: 'button', format: 'skip' },
                { selector: 'table', format: 'dataTable' },
                { selector: 'font', format: 'inlineSurround', options: { prefix: '***', suffix: '***' } },
                { selector: 'span', format: 'inlineSurround', options: { prefix: '***', suffix: '***' } },
            ],
        }).replace(/\n{3,}/g, '\n\n')

        const description = text.length > 2048 ? `${text.slice(0, 2045)}...` : text
        const images = section.querySelectorAll('img').map((img) => ({ url: img.getAttribute('src') }))

        embeds.push({
            title,
            url,
            thumbnail,
            description,
            image: images.shift(),
            category: news.category,
        })

        for (const image of images) {
            embeds.push({ url, image, category: news.category })
        }
    }

    return embeds
}

async function checkNewsDifference(queryD1, news) {
    const latestNews = await queryD1.listLatestNews()
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

    function* chunks(embeds) {
        const maxEmbeds = 10
        const maxChars = 3000

        for (let i = 0; i < embeds.length; ) {
            let totalChars = 0
            let j = i

            while (j < embeds.length && j - i < maxEmbeds) {
                const embed = embeds[j]
                const chars = (embed.title?.length || 0) + (embed.description?.length || 0)

                if (totalChars + chars > maxChars) {
                    break
                }

                totalChars += chars
                j++
            }

            yield embeds.slice(i, j)
            i = j
        }
    }

    // Split into smaller chunks to follow Discord embeds limit
    return newsEmbeds.flatMap((embeds) => [...chunks(embeds)])
}

async function sendPendingNews(queryD1, discordApi) {
    let count = 0

    while (count++ < 40) {
        const news = await queryD1.getFirstPendingNews()
        if (!news || news.sending) break

        try {
            await discordApi.post(Routes.channelMessages(news.channelId), {
                headers: { 'content-type': 'application/json' },
                passThroughBody: true,
                body: news.body,
            })
            await queryD1.deletePendingNews(news.id)
        } catch (error) {
            await queryD1.releasePendingNews(news.id)
            // 50001: Missing Access, 50013: Missing Permissions, 10003: Unknown Channel
            if ([50001, 50013, 10003].includes(error.code)) {
                await queryD1.unsubscribeChannel(news.channelId)
            } else {
                throw error
            }
        }
    }
}

async function verifyInteraction(request, publicKey) {
    const signature = request.headers.get('x-signature-ed25519')
    const timestamp = request.headers.get('x-signature-timestamp')
    const body = await request.text()
    const valid = await verifyKey(body, signature, timestamp, publicKey)
    const interaction = JSON.parse(body)

    return {
        valid,
        interaction,
    }
}

async function checkBotPermission(discordApi, channelId) {
    try {
        const message = await discordApi.post(Routes.channelMessages(channelId), {
            body: {
                embeds: [
                    {
                        title: '處理中',
                        description: '請稍後...',
                        url: 'https://example.com',
                    },
                ],
            },
        })
        await discordApi.delete(Routes.channelMessage(channelId, message.id))
        return true
    } catch (error) {
        return false
    }
}

function InteractionResponse(content, components = undefined, type = InteractionResponseType.ChannelMessageWithSource) {
    const body = JSON.stringify({ data: { content, components }, type })

    return new Response(body, {
        headers: {
            'content-type': 'application/json',
        },
    })
}

async function handleInteraction(queryD1, discordApi, interaction) {
    if (interaction.type === InteractionType.Ping) {
        return InteractionResponse(undefined, undefined, InteractionResponseType.Pong)
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
        const channelId = interaction.channel.id
        let content = ''

        switch (interaction.data.name) {
            case command.SUBSCRIBE.name:
                if (!(await checkBotPermission(discordApi, channelId))) {
                    content = '訂閱失敗！請檢查發送訊息、嵌入連結等相關權限。'
                    break
                }
                // Let user select categories
                return InteractionResponse(undefined, [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.StringSelect,
                                custom_id: 'select',
                                placeholder: '請選擇訂閱類別',
                                min_values: 1,
                                max_values: Object.values(categoryMap).length,
                                options: componentOptions,
                            },
                        ],
                    },
                ])
            case command.UNSUBSCRIBE.name:
                if (!(await queryD1.isChannelSubscribed(channelId))) {
                    content = '未訂閱！'
                } else {
                    await queryD1.unsubscribeChannel(channelId)
                    content = '取消訂閱成功！'
                }
                break
        }

        return InteractionResponse(content)
    }

    if (interaction.type === InteractionType.MessageComponent && interaction.data.component_type === ComponentType.StringSelect) {
        const allCategories = Object.values(categoryMap)
        const categories = interaction.data.values.sort((a, b) => allCategories.indexOf(a) - allCategories.indexOf(b))

        await discordApi.delete(Routes.channelMessage(interaction.channel.id, interaction.message.id))
        await queryD1.subscribeChannel(interaction.channel.id, categories)

        return InteractionResponse(`訂閱成功！類別：${categories.join('、')}`)
    }

    return new Response('Bad request.', { status: 400 })
}

export default {
    // Fetch latest news and send to Discord
    async scheduled(event, env, ctx) {
        const queryD1 = query(env.TORAM)
        const discordApi = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN)

        const news = await fetchNews()
        const { deletions, updates } = await checkNewsDifference(queryD1, news)

        if (updates.length) {
            const newsEmbeds = await generateNewsEmbeds(updates)
            await queryD1.updateLatestNews(deletions, updates, newsEmbeds)
        }

        await sendPendingNews(queryD1, discordApi)
    },
    // Handle Discord interactions
    async fetch(request, env, ctx) {
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed.', { status: 405 })
        }

        const queryD1 = query(env.TORAM)
        const discordApi = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN)
        const { valid, interaction } = await verifyInteraction(request, env.DISCORD_PUBLIC_KEY)

        if (!valid) {
            return new Response('Bad request signature.', { status: 401 })
        }

        return await handleInteraction(queryD1, discordApi, interaction)
    },
}
