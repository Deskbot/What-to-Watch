import * as cheerio from "cheerio"
import fetch from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { bug } from "../util"

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

    const reviewPageText = await fetch(url).then(res => res.text())
    const reviewPage = cheerio.load(reviewPageText)

    const { metascore, userscore } = await getScores(reviewPage)

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

    const bestResult = closestSearchResult(
        movie,
        searchResults,
        product => product.text().trim()
    )[0] // TOOD tiebreak properly

    if (!bestResult) return undefined

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