import { getMetacriticData, MetacriticResult } from "./metacritic"
import { csvFriendly, printable } from "./util"

export interface AllData {
    movie: string
    aggregateScore?: number
    metacritic?: MetacriticResult
}

export const csvHeaders = [
    "Movie",
    "Aggregate Score",
    "Metacritic Name",
    "Metacritic Critic Score",
    "Metacritic User Score",
    "IMDB Name",
    "IMDB Score",
    "Rotten Tomatoes Name",
    "Rotten Tomatoes Critic Score",
    "Rotten Tomatoes User Score",
] as const
export const csvHeaderRow = csvHeaders.join(",")

export type CsvHeaders = typeof csvHeaders[number]

export function aggregateScore(): number | undefined {
    // let scores = [] as number[]

    // const gog_score = gogData?.score
    // const metacritic_metascore = metacriticData?.metascore
    // const metacritic_userscore = metacriticData?.userscore
    // const steam_allTimeScore = steamResult?.allTimeScore
    // const steam_recentScore = steamResult?.recentScore

    // // make all scores out of 100
    // if (gog_score !== undefined) {
    //     scores.push(gog_score * 20)
    // }
    // if (metacritic_metascore !== undefined) {
    //     scores.push(metacritic_metascore)
    // }
    // if (metacritic_userscore !== undefined) {
    //     scores.push(metacritic_userscore * 10)
    // }
    // if (steam_allTimeScore !== undefined) {
    //     scores.push(steam_allTimeScore)
    // }
    // if (steam_recentScore !== undefined) {
    //     scores.push(steam_recentScore)
    // }

    // if (scores.length === 0) {
    //     return undefined
    // }

    // return parseFloat(average(scores).toFixed(1))
    return 0
}

const aggregateScoreFormula = (function(): string {
    // get cell references

    // const gog_score = csvHeaders.indexOf("GOG Score") + 1
    // const metacritic_metascore = csvHeaders.indexOf("Metacritic Critic Score") + 1
    // const metacritic_userscore = csvHeaders.indexOf("Metacritic User Score") + 1
    // const steam_allTimeScore = csvHeaders.indexOf("Steam All Time % Positive") + 1
    // const steam_recentScore = csvHeaders.indexOf("Steam Recent % Positive") + 1

    // const gog_score_cell = getCellInCol(gog_score)
    // const metacritic_metascore_cell = getCellInCol(metacritic_metascore)
    // const metacritic_userscore_cell = getCellInCol(metacritic_userscore)
    // const steam_allTimeScore_cell = getCellInCol(steam_allTimeScore)
    // const steam_recentScore_cell = getCellInCol(steam_recentScore)

    // const cells = [
    //     gog_score_cell,
    //     metacritic_metascore_cell,
    //     metacritic_userscore_cell,
    //     steam_allTimeScore_cell,
    //     steam_recentScore_cell,
    // ]

    // // normalise the scores to be out of 100
    // const scoreExpressions = [
    //     `(${gog_score_cell} * 20)`,
    //     `(${metacritic_metascore_cell})`,
    //     `(${metacritic_userscore_cell} * 10)`,
    //     `(${steam_allTimeScore_cell})`,
    //     `(${steam_recentScore_cell})`,
    // ]

    // // average the scores, ensure blank cells don't contribute to the average
    // const average = `(${scoreExpressions.join(" + ")}) / ${count(cells)}`

    // return `=IFERROR(${average}, "")`

    return ""
})()

/**
 * @param movie Movie to get data for
 * @param platforms An array of platforms to consider Metacritic reviews for
 * @param country 2-character country code defined by "ISO 3166-1 alpha-2", used by Steam
 */
export async function getCsv(movie: string): Promise<string> {
    const buffer = [] as string[]

    const data = await getData(movie)

    const newData: Record<CsvHeaders, string | number | undefined> = {
        "Movie": data.movie,
        "Aggregate Score": aggregateScoreFormula,
        "Metacritic Name": data.metacritic?.name,
        "Metacritic Critic Score": data.metacritic?.metascore,
        "Metacritic User Score": data.metacritic?.userscore,
        "IMDB Name": 0,
        "IMDB Score": 0,
        "Rotten Tomatoes Name": 0,
        "Rotten Tomatoes Critic Score": 0,
        "Rotten Tomatoes User Score": 0,
    }

    // iterate through in the same order every time guaranteed
    for (const key of csvHeaders) {
        buffer.push(csvFriendly(printable(newData[key])))
    }

    return buffer.join(",")
}

/**
 * @param movie Movie to get data for
 * @param platforms An array of platforms to consider Metacritic reviews for
 * @param country 2-character country code defined by "ISO 3166-1 alpha-2", used by Steam
 */
export async function getData(movie: string): Promise<AllData> {
    const handleError = (err: unknown, website: string) => {
        console.error(`Error: code failure, when getting "${movie}" from ${website}`)
        console.error(err)
        return undefined
    }

    // const gogDataProm =        gog.getData(movie)       .catch(err => handleError(err, "GOG"))
    const metacriticDataProm = getMetacriticData(movie).catch(err => handleError(err, "Metacritic"))
    // const steamDataProm =      steam.getData(movie)     .catch(err => handleError(err, "Steam"))
    // const hltbDataProm =       hltb.getData(movie)      .catch(err => handleError(err, "How Long to Beat"))

    // spawn all promises before blocking on their results
    // const gogData = await gogDataProm
    const metacriticData = await metacriticDataProm
    // const steamData = await steamDataProm

    return {
        movie,
        aggregateScore: 0, // aggregateScore(gogData, metacriticData, steamData),
        // gog: gogData,
        metacritic: metacriticData,
        // steam: steamData,
        // hltb: await hltbDataProm,
    }
}

/**
 * @param movie Movie to get data for
 * @param platforms An array of platforms to consider Metacritic reviews for
 * @param country 2-character country code defined by "ISO 3166-1 alpha-2", used by Steam
 */
export async function getJson(movie: string): Promise<string> {
    return JSON.stringify(await getData(movie))
}
