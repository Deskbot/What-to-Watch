import * as cheerio from "cheerio"
import fetch from "node-fetch"
import * as querystring from "querystring"
import { bug, nonNaN } from "./util"
import { closestSearchResult } from "./search"

type Score = number | "tbd" | "not found"

type BothScores = { metascore: Score, userscore: Score }

export interface MetacriticResult {
    name: string
    url: string
    metascore: Score
    userscore: Score
}

interface TargetMovie {
    name: string
    reviewUrl: string
}

export async function getData(movie: string): Promise<MetacriticResult | undefined> {
    const productData = await search(movie)
    if (productData === undefined) return undefined

    const { name, reviewUrl } = productData

    const reviewPageText = await fetch(reviewUrl).then(res => res.text());
    const reviewPage = cheerio.load(reviewPageText);

    const { metascore, userscore } = await getScores(reviewPage)

    return {
        name,
        url: reviewUrl,
        metascore,
        userscore,
    }
}

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
        if (str  == "") return "not found"

        if (str == "tbd") return "tbd"

        const f = parseFloat(metascoreStr)

        if (Number.isNaN(f)) return "not found"

        return f
    }

    return {
        metascore: parseScore(metascoreStr),
        userscore: parseScore(userscoreStr),
    }
}

async function search(movie: string): Promise<TargetMovie | undefined> {
    const movieStr = querystring.escape(movie)
    const searchUrl = `https://www.metacritic.com/search/movie/${movieStr}/results`

    const searchPageText = await fetch(searchUrl).then(res => res.text())
    const searchPage = cheerio.load(searchPageText)

    const searchResults = searchPage(".main_stats").find("a")
        .toArray()
        .map(searchPage)

    const bestResult = closestSearchResult(
        movie,
        searchResults,
        product => product.text().trim()
    )

    if (!bestResult) return undefined

    const name = bestResult.text().trim()

    const href = bestResult.attr("href")
    if (!href) bug()

    const reviewUrl = absoluteUrl(href)
    if (!reviewUrl) bug()

    return {
        name,
        reviewUrl,
    }
}

function absoluteUrl(relativeUrl: string): string {
    return "https://www.metacritic.com" + relativeUrl
}
