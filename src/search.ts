import * as levenshtein from "fastest-levenshtein"
import { LCS } from "js-lcs"

export function closestSearchResult<T>(
    movie: string,
    products: T[],
    getName: (product: T) => string,
): T[] {
    if (products.length === 0) return []

    const movieSanitised = sanitise(movie)

    const bestMatches: T[] = []

    // anything below 3 is insignificant
    // a product with lcs = 3 can still be outputted because it equals this
    let matchLcs = 3 // bigger is better
    let matchLevenshtein = Infinity // smaller is better

    for (const product of products) {
        const name = sanitise(getName(product))

        const productLcs = LCS.size(movieSanitised, name)

        // maybe replace best match with a product that has a smaller LCS
        if (productLcs > matchLcs) {
            matchLcs = productLcs
            matchLevenshtein = levenshtein.distance(movieSanitised, name) // store in case needed

            // replace list with new item
            bestMatches.splice(0)
            bestMatches.push(product)
        }

        // if they match, fallback on levenshtein comparison
        else if (productLcs === matchLcs) {
            const productLeven = levenshtein.distance(movieSanitised, name)

            // is this as good as or better than our current best
            if (productLeven <= matchLevenshtein) {

                // this product is better, so replace the list
                if (productLeven !== matchLevenshtein) {
                    bestMatches.splice(0)
                }

                matchLevenshtein = productLeven
                bestMatches.push(product)
            }
        }
    }

    if (bestMatches.length === 0) {
        return []
    }

    return bestMatches
}

const nonAlphanumeric = /[^a-z0-9\(\)]/g
function sanitise(str: string): string {
    return str.toLowerCase().replace(nonAlphanumeric, "")
}
