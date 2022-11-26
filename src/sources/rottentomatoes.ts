import fetch from "node-fetch"
import * as cheerio from "cheerio"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { bug, getHighest, limitConcurrent } from "../util"

const rottenTomatoesFetch = limitConcurrent(4, fetch)

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
        score?: string
    }
    criticsScore: {
        value: number | null
    }
    releaseYear: string
}

export async function getRottenTomatoesData(movie: string): Promise<RottenTomatoesResult | undefined> {
    const searchUrl = `https://www.rottentomatoes.com/search?search=${querystring.escape(movie)}`

    // make the website like us
    const userAgent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0"

    const searchPageText = await rottenTomatoesFetch(searchUrl, {
        method: "GET",
        headers: { "User-Agent": userAgent },
    })
        .then(res => res.text())

    const searchPage = cheerio.load(searchPageText)

    const searchResults = searchPage("search-page-result[type=movie]")
        .toArray()
        .map(searchPage)
        .map(makeSearchResult)

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

function makeSearchResult(dom: cheerio.Cheerio): RottenTomatoesResult {
    const link = dom.find("[slot=title]")

    const name = link.text() + dom.find("[class=year]").text()
    const url = link.attr("href") ?? ""
    const criticScore = parseInt(dom.find("[class=percentage]").text().replace("%", ""))
    const audienceScore = 123456789

    return {
        name,
        url,
        criticScore: Number.isNaN(criticScore) ? "not found" : criticScore,
        audienceScore,
    }
}

