import * as cheerio from "cheerio"
import fetch, { RequestInfo, RequestInit } from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { getHighest, limitConcurrent } from "../util"

const rottenTomatoesFetch = limitConcurrent(
    4,
    (url: RequestInfo, init?: (RequestInit & { headers?: { [key: string]: string } })) => {
        // make the website like us
        const userAgent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0"

        init = init ?? {}
        init.headers = init.headers ?? {}
        init.headers["User-Agent"] = userAgent

        return fetch(url, init)
    }
)

export type RottenTomatoesScore = number | "not found"

export type RottenTomatoesResult = {
    name: string
    url: string
    criticScore: RottenTomatoesScore
    audienceScore: RottenTomatoesScore
}

export async function getRottenTomatoesData(movie: string): Promise<RottenTomatoesResult | undefined> {
    const searchUrl = `https://www.rottentomatoes.com/search?search=${querystring.escape(movie)}`

    const searchPageText = await rottenTomatoesFetch(searchUrl)
        .then(res => res.text())

    const searchPage = cheerio.load(searchPageText)

    const searchResultsPromise = searchPage("search-page-result[type=movie] search-page-media-row")
        .toArray()
        .map(searchPage)
        .map(makeSearchResult)

    const searchResults = await Promise.all(searchResultsPromise)

    // find best match
    const targetResults = closestSearchResult(movie, searchResults, item => item.name)
    if (targetResults.length === 0) {
        return undefined
    }

    return getHighest(
        targetResults,
        (result1, result2) => {
            if (typeof result1.criticScore !== "number") {
                return -1
            }

            if (typeof result2.criticScore !== "number") {
                return 1
            }

            return result1.criticScore - result2.criticScore
        }
    )
}

async function makeSearchResult(searchResultRow: cheerio.Cheerio): Promise<RottenTomatoesResult> {
    const link = searchResultRow.find("[slot=title]")

    const name = link.text() + searchResultRow.find("[class=year]").text().trim()
    const url = link.attr("href") ?? ""
    const criticScore = parseInt(searchResultRow.attr("tomatometerscore") ?? "")
    const audienceScore = await getAudienceScore(url)

    return {
        name,
        url,
        criticScore: Number.isNaN(criticScore) ? "not found" : criticScore,
        audienceScore,
    }
}

async function getAudienceScore(reviewPageUrl: string): Promise<RottenTomatoesScore> {
    const reviewPageText = await rottenTomatoesFetch(reviewPageUrl)
        .then(res => res.text())

    const reviewPage = cheerio.load(reviewPageText)

    const percentageText = reviewPage("score-icon-audience").attr("percentage")
    const percentage = parseInt(percentageText ?? "")

    return Number.isNaN(percentage) ? "not found" : percentage
}
