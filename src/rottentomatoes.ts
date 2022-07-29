import fetch from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "./search"
import { bug } from "./util"

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
            tomatoMeterScore: {
                score: string
            }
            audienceScore: {
                score: string
            }
        }>
    }
}

export async function getRottenTomatoesData(movie: string): Promise<RottenTomatoesResult | undefined> {
    const movieStr = querystring.escape(movie)
    const searchUrl = `https://www.rottentomatoes.com/napi/search/all?searchQuery=${movieStr}&type=movie`

    const searchResponseText = await fetch(searchUrl).then(res => res.text())
    const searchResponse = JSON.parse(searchResponseText) as RottenTomatoesSearchResult

    const targetResult = closestSearchResult(movie, searchResponse.movie.items, item => item.name)
    if (targetResult === undefined) {
        return undefined
    }

    const criticScore = parseInt(targetResult.tomatoMeterScore.score)
    if (Number.isNaN(criticScore)) {
        bug()
    }

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
