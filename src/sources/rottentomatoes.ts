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

type SearchResults = {
    movie: {
        items: SearchedMovie[]
    }
}

type SearchedMovie = {
    name: string
    url: string
    audienceScore: {
        score: string
    }
    criticsScore: {
        value: number | null
    }
    releaseYear: string
}

export async function getRottenTomatoesData(movie: string): Promise<RottenTomatoesResult | undefined> {
    const movieStr = querystring.escape(movie)
    const searchUrl = `https://www.rottentomatoes.com/napi/search/all?searchQuery=${movieStr}&type=movie`

    // make the website like us
    const userAgent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0"

    const searchResponseText = await rottenTomatoesFetch(searchUrl, { headers: { "User-Agent": userAgent }})
        .then(res => res.text())
    const searchResponse = JSON.parse(searchResponseText) as SearchResults

    // add the year to the item name
    for (const item of searchResponse.movie.items) {
        item.name = `${item.name} (${item.releaseYear})`
    }

    // find best match
    const targetResults = closestSearchResult(movie, searchResponse.movie.items, item => item.name)
    if (targetResults.length === 0) {
        return undefined
    }

    const targetResult = getHighest(
        targetResults,
        (result1, result2) => (result1.criticsScore.value ?? -1) - (result2.criticsScore.value ?? -1)
    )

    if (targetResult === undefined) {
        return undefined
    }

    return convertSearchData(targetResult)
}

function convertSearchData(data: SearchedMovie): RottenTomatoesResult {
    const criticScore = data.criticsScore.value

    const audienceScore = parseInt(data.audienceScore.score)
    if (Number.isNaN(audienceScore)) {
        bug()
    }

    return {
        name: data.name,
        url: data.url,
        criticScore: criticScore ?? "not found",
        audienceScore,
    }
}
