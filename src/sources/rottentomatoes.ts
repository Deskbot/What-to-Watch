import fetch from "node-fetch"
import * as querystring from "querystring"
import { getRateLimit } from "../args"
import { closestSearchResult } from "../search"
import { bug, getHighest, limitConcurrent } from "../util"

const rottenTomatoesFetch = limitConcurrent(getRateLimit(), fetch)

export type RottenTomatoesScore = number | "not found"

export type RottenTomatoesResult = {
    name: string
    url: string
    criticScore: RottenTomatoesScore
    audienceScore: RottenTomatoesScore
}

type RottenTomatoesSearchResult = {
    movie: {
        items: Array<{
            name: string
            url: string
            audienceScore: {
                score: string
            }
            criticsScore: {
                value: number
            }
            releaseYear: string
        }>
    }
}

export async function getRottenTomatoesData(movie: string): Promise<RottenTomatoesResult | undefined> {
    const movieStr = querystring.escape(movie)
    const searchUrl = `https://www.rottentomatoes.com/napi/search/all?searchQuery=${movieStr}&type=movie`

    // make the website like us
    const userAgent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0"

    const searchResponseText = await rottenTomatoesFetch(searchUrl, { headers: { "User-Agent": userAgent }})
        .then(res => res.text())
    const searchResponse = JSON.parse(searchResponseText) as RottenTomatoesSearchResult

    // add the year to the item name
    for (const item of searchResponse.movie.items) {
        item.name = `${item.name} (${item.releaseYear})`
    }

    // find best match
    const targetResults = closestSearchResult(movie, searchResponse.movie.items, item => item.name)

    // if there are multiple equally good matches, choose the highest critic scoring one
    const targetResult = getHighest(
        targetResults,
        (result1, result2) => result1.criticsScore.value - result2.criticsScore.value
    )
    if (targetResult === undefined) {
        return undefined
    }

    // get scores

    const criticScore = targetResult.criticsScore.value

    const audienceScore = parseInt(targetResult.audienceScore.score)
    if (Number.isNaN(audienceScore)) {
        bug()
    }

    return {
        name: targetResult.name,
        url: targetResult.url,
        criticScore,
        audienceScore,
    }
}
