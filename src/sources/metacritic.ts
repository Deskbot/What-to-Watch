import * as cheerio from "cheerio"
import fetch from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { bug, buildMapFromAsyncOptional } from "../util"

export type MetacriticScore = number | "tbd" | "not found"

export interface MetacriticResult {
    name: string
    url: string
    metascore: MetacriticScore
    userscore: MetacriticScore
}

export async function getMetacriticData(movie: string): Promise<MetacriticResult | undefined> {
    const productData = await search(movie)
    if (productData === undefined) return undefined

    const name = `${productData.name} (${productData.year})`
    const url = productData.reviewUrl

    const { metascore, userscore } = await getScoresByUrl(url)

    return {
        name,
        url,
        metascore,
        userscore,
    }
}

type BothScores = Pick<MetacriticResult, "metascore" | "userscore">

async function getScores(scorePage: cheerio.Root): Promise<BothScores> {
    const product = scorePage.root().find(".product_header")

    const metascoreStr = product.find(".ms_wrapper")
        .find(".metascore_w")
        .first()
        .text()
        .trim()

    const userscoreStr = product.find(".us_wrapper")
        .find(".metascore_w")
        .first()
        .text()
        .trim()

    function parseScore(str: string) {
        if (str == "") return "not found"

        if (str == "tbd") return "tbd"

        const f = parseFloat(str)

        if (Number.isNaN(f)) return "not found"

        return f
    }

    return {
        metascore: parseScore(metascoreStr),
        userscore: parseScore(userscoreStr),
    }
}

interface TargetMovie {
    name: string
    reviewUrl: string
    year: number
}

async function search(movie: string): Promise<TargetMovie | undefined> {
    const movieStr = querystring.escape(movie)
    const searchUrl = `https://www.metacritic.com/search/movie/${movieStr}/results`

    const searchPageText = await fetch(searchUrl).then(res => res.text())
    const searchPage = cheerio.load(searchPageText)

    const searchResults = searchPage(".main_stats")
        .toArray()
        .map(searchPage)

    const bestResults = closestSearchResult(
        movie,
        searchResults,
        product => product.text().trim()
    )

    // when there are several equally good matches (e.g. films with the same name),
    // output the one with the best metascore

    // get scores

    const possibleTargets = bestResults.map(extractInfo)

    const searchResultScores = await buildMapFromAsyncOptional(possibleTargets, async (match) => {
        const { metascore } = await getScoresByUrl(match.reviewUrl)

        if (typeof metascore === "number") {
            return metascore
        }

        return undefined
    })

    // return the one with the best score

    let bestScore: number | undefined = undefined
    let bestTarget: TargetMovie | undefined

    for (const [result, score] of searchResultScores) {
        if (bestScore === undefined || score > bestScore) {
            bestTarget = result
            bestScore = score
        }
    }

    return bestTarget
}

async function getScoresByUrl(url: string) {
    const reviewPageText = await fetch(url).then(res => res.text())
    const reviewPage = cheerio.load(reviewPageText)

    return getScores(reviewPage)
}

function extractInfo(bestResult: cheerio.Cheerio): TargetMovie {
    const link = bestResult.find(".product_title").find("a")

    const name = link.text().trim()

    const href = link.attr("href")
    if (!href) bug()

    const reviewUrl = absoluteUrl(href)
    if (!reviewUrl) bug()

    const yearStr = bestResult.find("p").text().replace("Movie, ", "").trim()

    const year = parseInt(yearStr)
    if (Number.isNaN(year)) bug()

    return {
        name,
        reviewUrl,
        year,
    }
}

function absoluteUrl(relativeUrl: string): string {
    return "https://www.metacritic.com" + relativeUrl
}
